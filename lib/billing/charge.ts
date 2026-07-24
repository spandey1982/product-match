import { db } from "@/lib/db";
import type { BillingOperation, TransactionType, InsufficientCreditsError } from "./types";
import { isCreditBillingEnabled } from "./credit-check";
import { getActivePricingConfig, getRetailPrice } from "./pricing";
import { getOrCreateWallet } from "./wallet";

export interface ChargeSuccess {
  success: true;
  transactionId: string;
  priceUsd: number;
  pricingConfigId: string;
}

export type ChargeResult = ChargeSuccess | InsufficientCreditsError;

export async function chargeForCall(
  userId: string,
  operation: BillingOperation,
  count = 1,
  description?: string,
): Promise<ChargeResult> {
  if (!isCreditBillingEnabled()) {
    return { success: true, transactionId: "", priceUsd: 0, pricingConfigId: "" };
  }

  const pricing = await getActivePricingConfig();
  if (!pricing) {
    return { success: true, transactionId: "", priceUsd: 0, pricingConfigId: "" };
  }

  const unitPrice = getRetailPrice(pricing, operation);
  const totalCost = unitPrice != null && unitPrice > 0 ? unitPrice * count : 0;

  await getOrCreateWallet(userId);

  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      return { success: true as const, transactionId: "", priceUsd: 0, pricingConfigId: pricing.configId };
    }

    if (wallet.status === "frozen") {
      return {
        insufficientCredits: true as const,
        required: totalCost,
        available: 0,
        remainingPercentage: 0,
      };
    }

    if (wallet.balanceUsd <= 0 || wallet.balanceUsd < totalCost) {
      const totalCredits = wallet.totalCreditsUsd || 1;
      return {
        insufficientCredits: true as const,
        required: totalCost,
        available: wallet.balanceUsd,
        remainingPercentage: Math.round((wallet.balanceUsd / totalCredits) * 100),
      };
    }

    const newBalance = wallet.balanceUsd - totalCost;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceUsd: newBalance },
    });

    const label = count > 1 ? `${count}× ${operation}` : operation;

    const txn = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEDUCT" satisfies TransactionType,
        amountUsd: totalCost > 0 ? -totalCost : 0,
        balanceAfter: newBalance,
        description: description ?? label,
        pricingConfigId: pricing.configId,
        initiatedBy: "system",
      },
    });

    return {
      success: true as const,
      transactionId: txn.id,
      priceUsd: totalCost,
      pricingConfigId: pricing.configId,
    };
  });
}

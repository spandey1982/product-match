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

/**
 * Reverse a charge that was taken but shouldn't have been — e.g. a Gemini 429
 * (our own provider quota, not the retailer's balance) that leaves a run with
 * zero successful images despite `chargeForCall` already having succeeded.
 * Restores `balanceUsd` only; deliberately does NOT touch `totalCreditsUsd`
 * (unlike `adjustBalance`, which is for admin-granted credit and correctly
 * inflates it) — this is undoing an erroneous deduction, not granting new
 * credit. No-op for a non-positive amount or a missing wallet.
 */
export async function refundCharge(
  userId: string,
  amountUsd: number,
  description: string
): Promise<void> {
  if (amountUsd <= 0) return;

  await db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) return;

    const newBalance = wallet.balanceUsd + amountUsd;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceUsd: newBalance },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "RELEASE" satisfies TransactionType,
        amountUsd,
        balanceAfter: newBalance,
        description,
        initiatedBy: "system",
      },
    });
  });
}

import { db } from "@/lib/db";
import type { BillingOperation, TransactionType, InsufficientCreditsError } from "./types";
import { isCreditBillingEnabled } from "./credit-check";
import { getActivePricingConfig, getRetailPrice } from "./pricing";
import { getOrCreateWallet } from "./wallet";

export interface ChargeSuccess {
  success: true;
  transactionId: string;
  priceCredits: number;
  pricingConfigId: string;
}

export type ChargeResult = ChargeSuccess | InsufficientCreditsError;

/**
 * `count` is the unit multiplier — 1 per call for most operations, but the
 * number of seconds for "motion_clip" (priced per second) or the number of
 * sub-calls for a batched operation like "garment_intelligence".
 */
export async function chargeForCall(
  userId: string,
  operation: BillingOperation,
  count = 1,
  description?: string,
): Promise<ChargeResult> {
  if (!isCreditBillingEnabled()) {
    return { success: true, transactionId: "", priceCredits: 0, pricingConfigId: "" };
  }

  const pricing = await getActivePricingConfig();
  if (!pricing) {
    return { success: true, transactionId: "", priceCredits: 0, pricingConfigId: "" };
  }

  const unitPrice = getRetailPrice(pricing, operation);
  // Not rounded here — every configured unit price is an exact binary
  // fraction (halves/quarters), so unitPrice * count is always exact too.
  // garment_intelligence relies on this: 0.25 credits × 4 calls must sum to
  // precisely 1.0, not a rounded-per-call approximation.
  const totalCost = unitPrice != null && unitPrice > 0 ? unitPrice * count : 0;

  await getOrCreateWallet(userId);

  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      return { success: true as const, transactionId: "", priceCredits: 0, pricingConfigId: pricing.configId };
    }

    if (wallet.status === "frozen") {
      return {
        insufficientCredits: true as const,
        required: totalCost,
        available: 0,
        remainingPercentage: 0,
      };
    }

    if (wallet.balanceCredits <= 0 || wallet.balanceCredits < totalCost) {
      const totalCredits = wallet.totalCredits || 1;
      return {
        insufficientCredits: true as const,
        required: totalCost,
        available: wallet.balanceCredits,
        remainingPercentage: Math.round((wallet.balanceCredits / totalCredits) * 100),
      };
    }

    const newBalance = wallet.balanceCredits - totalCost;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceCredits: newBalance },
    });

    const label = count > 1 ? `${count}× ${operation}` : operation;

    const txn = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEDUCT" satisfies TransactionType,
        amountCredits: totalCost > 0 ? -totalCost : 0,
        balanceAfter: newBalance,
        description: description ?? label,
        pricingConfigId: pricing.configId,
        initiatedBy: "system",
      },
    });

    return {
      success: true as const,
      transactionId: txn.id,
      priceCredits: totalCost,
      pricingConfigId: pricing.configId,
    };
  });
}

/**
 * Reverse a charge that was taken but shouldn't have been — e.g. a Gemini 429
 * (our own provider quota, not the retailer's balance) that leaves a run with
 * zero successful images despite `chargeForCall` already having succeeded.
 * Restores `balanceCredits` only; deliberately does NOT touch `totalCredits`
 * (unlike `adjustBalance`, which is for admin-granted credit and correctly
 * inflates it) — this is undoing an erroneous deduction, not granting new
 * credit. No-op for a non-positive amount or a missing wallet.
 */
export async function refundCharge(
  userId: string,
  amountCredits: number,
  description: string
): Promise<void> {
  if (amountCredits <= 0) return;

  await db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) return;

    const newBalance = wallet.balanceCredits + amountCredits;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceCredits: newBalance },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "RELEASE" satisfies TransactionType,
        amountCredits,
        balanceAfter: newBalance,
        description,
        initiatedBy: "system",
      },
    });
  });
}

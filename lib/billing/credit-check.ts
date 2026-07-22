import type { BillingOperation, CreditCheckResult } from "./types";
import { getOrCreateWallet, getWalletBalance } from "./wallet";
import { getActivePricingConfig, sumRetailPrices } from "./pricing";
import { reserveCredits, settleReservation } from "./reservation";

export function isCreditBillingEnabled(): boolean {
  return process.env.ENABLE_CREDIT_BILLING === "true";
}

export async function withCreditCheck<T>(
  userId: string,
  operations: BillingOperation[],
  executeFn: () => Promise<T>
): Promise<CreditCheckResult<T>> {
  if (!isCreditBillingEnabled()) {
    return { result: await executeFn() };
  }

  const pricing = await getActivePricingConfig();
  if (!pricing) {
    return { result: await executeFn() };
  }

  const totalCost = sumRetailPrices(pricing, operations);
  if (totalCost <= 0) {
    return { result: await executeFn() };
  }

  await getOrCreateWallet(userId);

  const balance = await getWalletBalance(userId);
  if (!balance) {
    return { result: await executeFn() };
  }

  const opCounts = new Map<string, number>();
  for (const op of operations) opCounts.set(op, (opCounts.get(op) ?? 0) + 1);
  const description = `Reserve: ${[...opCounts.entries()].map(([op, n]) => `${n}x ${op}`).join(", ")}`;
  const reservation = await reserveCredits(userId, totalCost, description);

  if (!reservation.success) {
    if (reservation.reason === "insufficient_credits") {
      return {
        insufficientCredits: true,
        required: totalCost,
        available: reservation.available ?? 0,
        remainingPercentage: balance.remainingPercentage,
      };
    }

    if (reservation.reason === "wallet_frozen") {
      return {
        insufficientCredits: true,
        required: totalCost,
        available: 0,
        remainingPercentage: 0,
      };
    }

    return { result: await executeFn() };
  }

  try {
    const result = await executeFn();

    await settleReservation(reservation.reservationId, {
      success: true,
      pricingConfigId: pricing.configId,
    });

    return { result };
  } catch (err) {
    await settleReservation(reservation.reservationId, {
      success: false,
    });
    throw err;
  }
}

export function estimateCatalogueOps(
  hasGarmentIntelligence: boolean,
  quality?: string | null,
  hasBackImage?: boolean
): BillingOperation[] {
  const ops: BillingOperation[] = [];

  ops.push("metadata_extract");

  if (!hasGarmentIntelligence) {
    // GI pipeline: overview (1) + batched close-ups (1) + back analysis (1 if back image)
    ops.push("garment_intelligence", "garment_intelligence");
    if (hasBackImage) ops.push("garment_intelligence");
  }

  const imgOp: BillingOperation = quality === "enhanced" ? "image_gen_2k" : "image_gen_1k";
  ops.push(imgOp, imgOp);

  return ops;
}

export function estimateTryOnOps(): BillingOperation[] {
  return ["tryon_1k"];
}

export function estimateQuickListingOps(
  quality?: string | null
): BillingOperation[] {
  const ops: BillingOperation[] = [];
  ops.push("metadata_extract");
  const imgOp: BillingOperation = quality === "enhanced" ? "image_gen_2k" : "image_gen_1k";
  ops.push(imgOp);
  return ops;
}

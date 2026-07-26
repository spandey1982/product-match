import { db } from "@/lib/db";
import type { WalletBalance, WalletStatus, TransactionType } from "./types";
import { fetchExchangeRate, convertInrToUsd } from "./exchange";

export async function getOrCreateWallet(userId: string) {
  const existing = await db.wallet.findUnique({ where: { userId } });
  if (existing) return existing;

  return db.wallet.create({
    data: { userId, balanceUsd: 0, totalCreditsUsd: 0, status: "active" },
  });
}

export async function getWalletByUserId(userId: string) {
  return db.wallet.findUnique({ where: { userId } });
}

export async function getWalletBalance(userId: string): Promise<WalletBalance | null> {
  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) return null;

  const remainingPercentage =
    wallet.totalCreditsUsd > 0
      ? Math.round((wallet.balanceUsd / wallet.totalCreditsUsd) * 100)
      : 0;

  return {
    balanceUsd: wallet.balanceUsd,
    totalCreditsUsd: wallet.totalCreditsUsd,
    usedPercentage: 100 - remainingPercentage,
    remainingPercentage,
    status: wallet.status as WalletStatus,
  };
}

/**
 * Credits a wallet and records the transaction. `initiatedBy`/`description`
 * default to the admin-top-up wording (existing behavior, unchanged for that
 * caller); pass overrides for other credit sources — e.g. a Razorpay
 * payment, where `initiatedBy` should identify the payment, not an admin.
 */
export async function addCredits(
  userId: string,
  amountInr: number,
  adminUserId: string,
  overrides?: { initiatedBy?: string; description?: string }
): Promise<{ walletId: string; creditedUsd: number; exchangeRate: number; walletTransactionId: string }> {
  const rate = await fetchExchangeRate();
  const creditUsd = convertInrToUsd(amountInr, rate);

  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: {
        userId,
        balanceUsd: creditUsd,
        totalCreditsUsd: creditUsd,
        status: "active",
        lastExchangeRate: rate,
      },
      update: {
        balanceUsd: { increment: creditUsd },
        totalCreditsUsd: { increment: creditUsd },
        lastExchangeRate: rate,
      },
    });

    const walletTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT" satisfies TransactionType,
        amountUsd: creditUsd,
        balanceAfter: wallet.balanceUsd,
        description:
          overrides?.description ??
          `Top-up: ₹${amountInr.toLocaleString("en-IN")} @ ₹${rate.toFixed(2)}/USD`,
        initiatedBy: overrides?.initiatedBy ?? `admin:${adminUserId}`,
        originalAmountInr: amountInr,
        exchangeRate: rate,
      },
    });

    return { walletId: wallet.id, creditedUsd: creditUsd, exchangeRate: rate, walletTransactionId: walletTx.id };
  });
}

/**
 * Credits a wallet for a Razorpay `PaymentOrder`, called from both the
 * client-side verify-payment flow and the server-side webhook — either can
 * arrive first, or both can fire for the same order. The `status !== "paid"`
 * transition is claimed atomically inside the transaction (via
 * `updateMany`'s row count) so only one caller ever credits the wallet;
 * the other sees `alreadyProcessed: true` instead of double-crediting.
 */
export async function creditWalletForPaymentOrder(
  paymentOrderId: string,
  razorpayPaymentId: string
): Promise<{ creditedUsd: number; exchangeRate: number; alreadyProcessed: boolean }> {
  const paymentOrder = await db.paymentOrder.findUnique({ where: { id: paymentOrderId } });
  if (!paymentOrder) throw new Error("Payment order not found");

  if (paymentOrder.status === "paid") {
    return {
      creditedUsd: paymentOrder.amountUsd ?? 0,
      exchangeRate: paymentOrder.exchangeRate ?? 0,
      alreadyProcessed: true,
    };
  }

  const rate = await fetchExchangeRate();
  const creditUsd = convertInrToUsd(paymentOrder.amountInr, rate);

  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.paymentOrder.updateMany({
      where: { id: paymentOrder.id, status: { not: "paid" } },
      data: { status: "paid", razorpayPaymentId, amountUsd: creditUsd, exchangeRate: rate },
    });
    if (claimed.count === 0) return null; // lost the race — the other caller already processed this order

    const wallet = await tx.wallet.upsert({
      where: { userId: paymentOrder.userId },
      create: {
        userId: paymentOrder.userId,
        balanceUsd: creditUsd,
        totalCreditsUsd: creditUsd,
        status: "active",
        lastExchangeRate: rate,
      },
      update: {
        balanceUsd: { increment: creditUsd },
        totalCreditsUsd: { increment: creditUsd },
        lastExchangeRate: rate,
      },
    });

    const walletTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT" satisfies TransactionType,
        amountUsd: creditUsd,
        balanceAfter: wallet.balanceUsd,
        description: paymentOrder.description ?? `Credit top-up: ${paymentOrder.packLabel ?? "custom"}`,
        initiatedBy: `razorpay:${razorpayPaymentId}`,
        originalAmountInr: paymentOrder.amountInr,
        exchangeRate: rate,
      },
    });

    await tx.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: { walletTransactionId: walletTx.id },
    });

    return { creditedUsd: creditUsd, exchangeRate: rate };
  });

  if (!result) {
    return { creditedUsd: creditUsd, exchangeRate: rate, alreadyProcessed: true };
  }
  return { ...result, alreadyProcessed: false };
}

export async function adjustBalance(
  userId: string,
  amountUsd: number,
  description: string,
  adminUserId: string
) {
  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");

    const newBalance = wallet.balanceUsd + amountUsd;
    if (newBalance < 0) throw new Error("Adjustment would result in negative balance");

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balanceUsd: newBalance,
        ...(amountUsd > 0 ? { totalCreditsUsd: { increment: amountUsd } } : {}),
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "ADJUSTMENT" satisfies TransactionType,
        amountUsd,
        balanceAfter: newBalance,
        description,
        initiatedBy: `admin:${adminUserId}`,
      },
    });

    return { balanceUsd: newBalance };
  });
}

export async function resetWallet(userId: string, adminUserId: string) {
  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");

    const previousBalance = wallet.balanceUsd;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceUsd: 0, totalCreditsUsd: 0 },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "RESET" satisfies TransactionType,
        amountUsd: -previousBalance,
        balanceAfter: 0,
        description: "Wallet reset by admin",
        initiatedBy: `admin:${adminUserId}`,
      },
    });
  });
}

export async function freezeWallet(userId: string) {
  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("Wallet not found");

  const newStatus: WalletStatus =
    wallet.status === "frozen" ? "active" : "frozen";

  await db.wallet.update({
    where: { id: wallet.id },
    data: { status: newStatus },
  });

  return { status: newStatus };
}

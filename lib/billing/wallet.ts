import { db } from "@/lib/db";
import type { WalletBalance, WalletStatus, TransactionType } from "./types";
import { convertInrToCredits } from "./exchange";

export async function getOrCreateWallet(userId: string) {
  const existing = await db.wallet.findUnique({ where: { userId } });
  if (existing) return existing;

  return db.wallet.create({
    data: { userId, balanceCredits: 0, totalCredits: 0, status: "active" },
  });
}

export async function getWalletByUserId(userId: string) {
  return db.wallet.findUnique({ where: { userId } });
}

export async function getWalletBalance(userId: string): Promise<WalletBalance | null> {
  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet) return null;

  const remainingPercentage =
    wallet.totalCredits > 0
      ? Math.round((wallet.balanceCredits / wallet.totalCredits) * 100)
      : 0;

  return {
    balanceCredits: wallet.balanceCredits,
    totalCredits: wallet.totalCredits,
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
): Promise<{ walletId: string; creditedCredits: number; walletTransactionId: string }> {
  const creditedCredits = convertInrToCredits(amountInr);

  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: {
        userId,
        balanceCredits: creditedCredits,
        totalCredits: creditedCredits,
        status: "active",
      },
      update: {
        balanceCredits: { increment: creditedCredits },
        totalCredits: { increment: creditedCredits },
      },
    });

    const walletTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT" satisfies TransactionType,
        amountCredits: creditedCredits,
        balanceAfter: wallet.balanceCredits,
        description:
          overrides?.description ??
          `Top-up: Rs ${amountInr.toLocaleString("en-IN")} → ${creditedCredits} credits`,
        initiatedBy: overrides?.initiatedBy ?? `admin:${adminUserId}`,
        originalAmountInr: amountInr,
      },
    });

    return { walletId: wallet.id, creditedCredits, walletTransactionId: walletTx.id };
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
): Promise<{ creditedCredits: number; alreadyProcessed: boolean }> {
  const paymentOrder = await db.paymentOrder.findUnique({ where: { id: paymentOrderId } });
  if (!paymentOrder) throw new Error("Payment order not found");

  if (paymentOrder.status === "paid") {
    return {
      creditedCredits: paymentOrder.amountCredits ?? 0,
      alreadyProcessed: true,
    };
  }

  const creditedCredits = convertInrToCredits(paymentOrder.amountInr);

  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.paymentOrder.updateMany({
      where: { id: paymentOrder.id, status: { not: "paid" } },
      data: { status: "paid", razorpayPaymentId, amountCredits: creditedCredits },
    });
    if (claimed.count === 0) return null; // lost the race — the other caller already processed this order

    const wallet = await tx.wallet.upsert({
      where: { userId: paymentOrder.userId },
      create: {
        userId: paymentOrder.userId,
        balanceCredits: creditedCredits,
        totalCredits: creditedCredits,
        status: "active",
      },
      update: {
        balanceCredits: { increment: creditedCredits },
        totalCredits: { increment: creditedCredits },
      },
    });

    const walletTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT" satisfies TransactionType,
        amountCredits: creditedCredits,
        balanceAfter: wallet.balanceCredits,
        description: paymentOrder.description ?? `Credit top-up: ${paymentOrder.packLabel ?? "custom"}`,
        initiatedBy: `razorpay:${razorpayPaymentId}`,
        originalAmountInr: paymentOrder.amountInr,
      },
    });

    await tx.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: { walletTransactionId: walletTx.id },
    });

    return { creditedCredits };
  });

  if (!result) {
    return { creditedCredits, alreadyProcessed: true };
  }
  return { ...result, alreadyProcessed: false };
}

export async function adjustBalance(
  userId: string,
  amountCredits: number,
  description: string,
  adminUserId: string
) {
  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");

    const newBalance = wallet.balanceCredits + amountCredits;
    if (newBalance < 0) throw new Error("Adjustment would result in negative balance");

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balanceCredits: newBalance,
        ...(amountCredits > 0 ? { totalCredits: { increment: amountCredits } } : {}),
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "ADJUSTMENT" satisfies TransactionType,
        amountCredits,
        balanceAfter: newBalance,
        description,
        initiatedBy: `admin:${adminUserId}`,
      },
    });

    return { balanceCredits: newBalance };
  });
}

export async function resetWallet(userId: string, adminUserId: string) {
  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");

    const previousBalance = wallet.balanceCredits;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceCredits: 0, totalCredits: 0 },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "RESET" satisfies TransactionType,
        amountCredits: -previousBalance,
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

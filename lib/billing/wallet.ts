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

export async function addCredits(
  userId: string,
  amountInr: number,
  adminUserId: string
): Promise<{ walletId: string; creditedUsd: number; exchangeRate: number }> {
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

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT" satisfies TransactionType,
        amountUsd: creditUsd,
        balanceAfter: wallet.balanceUsd,
        description: `Top-up: ₹${amountInr.toLocaleString("en-IN")} @ ₹${rate.toFixed(2)}/USD`,
        initiatedBy: `admin:${adminUserId}`,
        originalAmountInr: amountInr,
        exchangeRate: rate,
      },
    });

    return { walletId: wallet.id, creditedUsd: creditUsd, exchangeRate: rate };
  });
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

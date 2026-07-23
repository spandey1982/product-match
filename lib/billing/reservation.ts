import { db } from "@/lib/db";
import type { TransactionType } from "./types";

interface ReserveResult {
  success: true;
  reservationId: string;
  walletId: string;
}

interface ReserveError {
  success: false;
  reason: "insufficient_credits" | "wallet_frozen" | "wallet_not_found";
  available?: number;
}

export async function reserveCredits(
  userId: string,
  amountUsd: number,
  description: string
): Promise<ReserveResult | ReserveError> {
  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      return { success: false as const, reason: "wallet_not_found" as const };
    }

    if (wallet.status === "frozen") {
      return { success: false as const, reason: "wallet_frozen" as const };
    }

    if (wallet.balanceUsd < amountUsd) {
      return {
        success: false as const,
        reason: "insufficient_credits" as const,
        available: wallet.balanceUsd,
      };
    }

    const newBalance = wallet.balanceUsd - amountUsd;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceUsd: newBalance },
    });

    const txn = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "RESERVE" satisfies TransactionType,
        amountUsd: -amountUsd,
        balanceAfter: newBalance,
        description,
        initiatedBy: "system",
      },
    });

    return {
      success: true as const,
      reservationId: txn.id,
      walletId: wallet.id,
    };
  });
}

export async function settleReservation(
  reservationId: string,
  opts: {
    success: boolean;
    actualAmountUsd?: number;
    aiUsageEventId?: string;
    pricingConfigId?: string;
  }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const reservation = await tx.walletTransaction.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.type !== "RESERVE") return;

    const reservedAmount = Math.abs(reservation.amountUsd);
    const wallet = await tx.wallet.findUnique({
      where: { id: reservation.walletId },
    });
    if (!wallet) return;

    if (opts.success) {
      const actualAmount = opts.actualAmountUsd ?? reservedAmount;
      const refund = reservedAmount - actualAmount;

      if (refund > 0) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceUsd: { increment: refund } },
        });
      }

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "DEDUCT" satisfies TransactionType,
          amountUsd: -actualAmount,
          balanceAfter: wallet.balanceUsd + refund,
          description: reservation.description.replace(/^Reserve: /, ""),
          reservationId,
          aiUsageEventId: opts.aiUsageEventId ?? null,
          pricingConfigId: opts.pricingConfigId ?? null,
          initiatedBy: "system",
        },
      });
    } else {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceUsd: { increment: reservedAmount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "RELEASE" satisfies TransactionType,
          amountUsd: reservedAmount,
          balanceAfter: wallet.balanceUsd + reservedAmount,
          description: `Released: ${reservation.description}`,
          reservationId,
          initiatedBy: "system",
        },
      });
    }
  });
}

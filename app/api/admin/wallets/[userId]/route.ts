import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        storeName: true,
        wallet: {
          select: {
            id: true,
            balanceUsd: true,
            totalCreditsUsd: true,
            status: true,
            lastExchangeRate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const recentTransactions = user.wallet
      ? await db.walletTransaction.findMany({
          where: { walletId: user.wallet.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [];

    const w = user.wallet;
    const remainingPct = w && w.totalCreditsUsd > 0
      ? Math.round((w.balanceUsd / w.totalCreditsUsd) * 100)
      : 0;

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        storeName: user.storeName,
      },
      wallet: w
        ? {
            id: w.id,
            balanceUsd: w.balanceUsd,
            totalCreditsUsd: w.totalCreditsUsd,
            usedUsd: w.totalCreditsUsd - w.balanceUsd,
            remainingPercentage: remainingPct,
            status: w.status,
            lastExchangeRate: w.lastExchangeRate,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
          }
        : null,
      recentTransactions,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

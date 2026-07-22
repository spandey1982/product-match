import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();

    const users = await db.user.findMany({
      where: { role: "RETAILER" },
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
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const wallets = users.map((u) => {
      const w = u.wallet;
      const usedUsd = w ? w.totalCreditsUsd - w.balanceUsd : 0;
      const remainingPct = w && w.totalCreditsUsd > 0
        ? Math.round((w.balanceUsd / w.totalCreditsUsd) * 100)
        : 0;

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        storeName: u.storeName,
        wallet: w
          ? {
              id: w.id,
              balanceUsd: w.balanceUsd,
              totalCreditsUsd: w.totalCreditsUsd,
              usedUsd,
              remainingPercentage: remainingPct,
              status: w.status,
              lastExchangeRate: w.lastExchangeRate,
              lastUpdated: w.updatedAt,
            }
          : null,
      };
    });

    return NextResponse.json({ wallets });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

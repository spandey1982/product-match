import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getWalletBalance } from "@/lib/billing/wallet";

export async function GET() {
  try {
    const session = await requireAuth();
    const balance = await getWalletBalance(session.id);

    if (!balance) {
      return NextResponse.json({
        hasWallet: false,
        balanceUsd: 0,
        totalCreditsUsd: 0,
        remainingPercentage: 0,
        usedPercentage: 0,
        status: "active",
      });
    }

    return NextResponse.json({
      hasWallet: true,
      balanceUsd: balance.balanceUsd,
      totalCreditsUsd: balance.totalCreditsUsd,
      remainingPercentage: balance.remainingPercentage,
      usedPercentage: balance.usedPercentage,
      status: balance.status,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

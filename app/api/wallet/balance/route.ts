import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getWalletBalance } from "@/lib/billing/wallet";
import { isCreditBillingEnabled } from "@/lib/billing/credit-check";

export async function GET() {
  try {
    const session = await requireAuth();

    if (!isCreditBillingEnabled()) {
      return NextResponse.json({
        billingEnabled: false,
        remainingPercentage: 100,
      });
    }

    const balance = await getWalletBalance(session.id);

    return NextResponse.json({
      billingEnabled: true,
      hasWallet: !!balance,
      remainingPercentage: balance?.remainingPercentage ?? 0,
      usedPercentage: balance?.usedPercentage ?? 0,
      status: balance?.status ?? "active",
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

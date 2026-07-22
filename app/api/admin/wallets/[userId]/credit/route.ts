import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { addCredits } from "@/lib/billing/wallet";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { userId } = await params;

    const body = await req.json();
    const amountInr = Number(body.amountInr);

    if (!amountInr || amountInr <= 0) {
      return NextResponse.json(
        { error: "amountInr must be a positive number" },
        { status: 400 }
      );
    }

    const result = await addCredits(userId, amountInr, admin.id);

    return NextResponse.json({
      success: true,
      creditedUsd: result.creditedUsd,
      exchangeRate: result.exchangeRate,
      walletId: result.walletId,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (msg.includes("exchange rate")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

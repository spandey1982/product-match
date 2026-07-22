import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { freezeWallet } from "@/lib/billing/wallet";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await params;

    const result = await freezeWallet(userId);

    return NextResponse.json({ success: true, status: result.status });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (msg === "Wallet not found") return NextResponse.json({ error: msg }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

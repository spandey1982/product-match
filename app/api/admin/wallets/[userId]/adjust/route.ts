import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adjustBalance } from "@/lib/billing/wallet";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { userId } = await params;

    const body = await req.json();
    const amountUsd = Number(body.amountUsd);
    const description = String(body.description || "Manual adjustment");

    if (!amountUsd || amountUsd === 0) {
      return NextResponse.json(
        { error: "amountUsd must be a non-zero number" },
        { status: 400 }
      );
    }

    const result = await adjustBalance(userId, amountUsd, description, admin.id);

    return NextResponse.json({ success: true, balanceUsd: result.balanceUsd });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (msg === "Wallet not found") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg.includes("negative balance")) return NextResponse.json({ error: msg }, { status: 422 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

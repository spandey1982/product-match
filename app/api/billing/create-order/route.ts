import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  CREDIT_PACKS,
} from "@/lib/billing/razorpay";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    if (!isRazorpayConfigured()) {
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 503 },
      );
    }

    const body = (await req.json()) as { packId?: string; customAmountInr?: number };

    let amountInr: number;
    let packLabel: string;

    if (body.packId) {
      const pack = CREDIT_PACKS.find((p) => p.id === body.packId);
      if (!pack) {
        return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
      }
      amountInr = pack.amountInr;
      packLabel = pack.label;
    } else if (body.customAmountInr && typeof body.customAmountInr === "number") {
      if (body.customAmountInr < 100 || body.customAmountInr > 100000) {
        return NextResponse.json(
          { error: "Amount must be between ₹100 and ₹1,00,000" },
          { status: 400 },
        );
      }
      amountInr = Math.round(body.customAmountInr);
      packLabel = `₹${amountInr.toLocaleString("en-IN")}`;
    } else {
      return NextResponse.json(
        { error: "packId or customAmountInr is required" },
        { status: 400 },
      );
    }

    const rzOrder = await createRazorpayOrder({
      amountInr,
      userId: session.id,
      packLabel,
    });

    await db.paymentOrder.create({
      data: {
        userId: session.id,
        razorpayOrderId: rzOrder.id,
        amountInr,
        currency: rzOrder.currency,
        status: "created",
        packLabel,
        description: `Credit top-up: ${packLabel}`,
      },
    });

    return NextResponse.json({
      orderId: rzOrder.id,
      amountInr,
      amountPaise: Math.round(amountInr * 100),
      currency: rzOrder.currency,
      packLabel,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((err as Error).message === "Razorpay API keys not configured") {
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 503 },
      );
    }
    console.error("[create-order]", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}

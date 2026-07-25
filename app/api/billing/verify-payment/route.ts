import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPaymentSignature } from "@/lib/billing/razorpay";
import { creditWalletForPaymentOrder } from "@/lib/billing/wallet";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const body = (await req.json()) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
    }

    const isValid = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!isValid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const paymentOrder = await db.paymentOrder.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });
    if (!paymentOrder) {
      return NextResponse.json({ error: "Payment order not found" }, { status: 404 });
    }
    if (paymentOrder.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await creditWalletForPaymentOrder(paymentOrder.id, razorpay_payment_id);

    return NextResponse.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed,
      amountInr: paymentOrder.amountInr,
      creditedUsd: result.creditedUsd,
      exchangeRate: result.exchangeRate,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[verify-payment]", err);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
  }
}

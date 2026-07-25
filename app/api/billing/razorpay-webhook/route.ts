import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { creditWalletForPaymentOrder } from "@/lib/billing/wallet";

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
      };
    };
  };
}

/**
 * Server-to-server fallback for when the client never calls verify-payment
 * (tab closed mid-checkout, network drop after payment succeeded, etc.).
 * `creditWalletForPaymentOrder` is safe to call from both this and
 * verify-payment for the same order — only one of them ever actually credits.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    // A missing signature is rejected, not skipped — an empty signature must
    // never be treated as "verification not required."
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;

    if (payload.event === "payment.captured") {
      const payment = payload.payload.payment?.entity;
      if (!payment) return NextResponse.json({ status: "ignored" });

      const paymentOrder = await db.paymentOrder.findUnique({
        where: { razorpayOrderId: payment.order_id },
      });
      if (!paymentOrder) {
        console.warn("[razorpay-webhook] Unknown order:", payment.order_id);
        return NextResponse.json({ status: "ignored" });
      }

      const result = await creditWalletForPaymentOrder(paymentOrder.id, payment.id);
      return NextResponse.json({ status: result.alreadyProcessed ? "already_processed" : "credited" });
    }

    if (payload.event === "payment.failed") {
      const payment = payload.payload.payment?.entity;
      if (!payment) return NextResponse.json({ status: "ignored" });

      await db.paymentOrder.updateMany({
        where: { razorpayOrderId: payment.order_id, status: { not: "paid" } },
        data: { status: "failed", razorpayPaymentId: payment.id },
      });
      return NextResponse.json({ status: "marked_failed" });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    console.error("[razorpay-webhook]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

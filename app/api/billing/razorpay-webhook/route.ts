import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { creditWalletForPaymentOrder } from "@/lib/billing/wallet";
import { markRentalOrderPaid, markRentalPaymentFailed } from "@/lib/rental/payment";

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
 * Server-to-server fallback for when the client never calls its verify API
 * (tab closed mid-checkout, network drop after payment succeeded, etc.).
 * Shared by both Razorpay integrations in this app — the retailer AI-credit
 * wallet top-up (`PaymentOrder`) and rental booking prepayment (`Payment`) —
 * rather than registering two webhook URLs for the same signature-verification
 * logic. A given razorpayOrderId only ever exists in one of the two tables,
 * so checking PaymentOrder first and falling through to Payment is safe.
 * The credit/mark-paid helpers are each safe to call from both this and
 * their respective verify API for the same order — only one caller ever
 * actually applies the change; the other sees `alreadyProcessed: true`.
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
      if (paymentOrder) {
        const result = await creditWalletForPaymentOrder(paymentOrder.id, payment.id);
        return NextResponse.json({ status: result.alreadyProcessed ? "already_processed" : "credited" });
      }

      const rentalPayment = await db.payment.findUnique({
        where: { razorpayOrderId: payment.order_id },
      });
      if (rentalPayment) {
        const result = await markRentalOrderPaid(rentalPayment.id, payment.id);
        return NextResponse.json({ status: result.alreadyProcessed ? "already_processed" : "paid" });
      }

      console.warn("[razorpay-webhook] Unknown order:", payment.order_id);
      return NextResponse.json({ status: "ignored" });
    }

    if (payload.event === "payment.failed") {
      const payment = payload.payload.payment?.entity;
      if (!payment) return NextResponse.json({ status: "ignored" });

      await db.paymentOrder.updateMany({
        where: { razorpayOrderId: payment.order_id, status: { not: "paid" } },
        data: { status: "failed", razorpayPaymentId: payment.id },
      });
      await markRentalPaymentFailed(payment.order_id, payment.id);
      return NextResponse.json({ status: "marked_failed" });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    console.error("[razorpay-webhook]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

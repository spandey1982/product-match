import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { verifyPaymentSignature } from "@/lib/billing/razorpay";
import { markRentalOrderPaid } from "@/lib/rental/payment";

export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const payment = await db.payment.findUnique({ where: { razorpayOrderId: razorpay_order_id } });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    if (payment.customerId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await markRentalOrderPaid(payment.id, razorpay_payment_id, razorpay_signature);

    return NextResponse.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed,
      amountInr: result.amountInr,
    });
  } catch (err) {
    console.error("[payments/verify]", err);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
  }
}

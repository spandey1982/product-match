import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { createRazorpayOrder, isRazorpayConfigured, getRazorpayKeyId } from "@/lib/billing/razorpay";
import { computeRentalOrderAmountPaise } from "@/lib/rental/payment";

/**
 * Creates a Razorpay order for prepaying a rental booking. Pay at Doorstep
 * remains available regardless — this only starts an optional online-payment
 * attempt. Amount is always computed server-side from the booking's own
 * rentalPricePerDay/rentalDurationDays/deposit, never accepted from the client.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in to pay online." }, { status: 401 });
    }

    if (!isRazorpayConfigured()) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    const body = (await req.json()) as { rentalOrderId?: string };
    const { rentalOrderId } = body;
    if (!rentalOrderId) {
      return NextResponse.json({ error: "rentalOrderId is required" }, { status: 400 });
    }

    const order = await db.rentalOrder.findUnique({ where: { id: rentalOrderId } });
    if (!order) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (order.customerId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "This booking is already paid" }, { status: 409 });
    }

    const amountPaise = computeRentalOrderAmountPaise(order);
    const amountInr = amountPaise / 100;

    const rzOrder = await createRazorpayOrder({
      amountInr,
      userId: session.id,
      packLabel: `Rental booking ${order.productTitle}`,
      notes: { rentalOrderId: order.id },
    });

    await db.payment.create({
      data: {
        rentalOrderId: order.id,
        customerId: session.id,
        razorpayOrderId: rzOrder.id,
        amount: amountPaise,
        currency: rzOrder.currency,
        status: "created",
      },
    });

    return NextResponse.json({
      orderId: rzOrder.id,
      amount: amountPaise,
      currency: rzOrder.currency,
      keyId: getRazorpayKeyId(),
    });
  } catch (err) {
    if ((err as Error).message === "Razorpay API keys not configured") {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }
    console.error("[payments/create-order]", err);
    return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 });
  }
}

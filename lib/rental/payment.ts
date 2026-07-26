import { db } from "@/lib/db";

/**
 * Server-side payable amount for a rental booking — never trust a
 * client-submitted amount. Charges the full rental cost for the booked
 * duration plus the refundable deposit in one payment (both options —
 * prepay online or pay the same total at doorstep — remain valid; this is
 * only what an online payment attempt charges).
 */
export function computeRentalOrderAmountPaise(order: {
  rentalPricePerDay: number;
  rentalDurationDays: number;
  deposit: number;
}): number {
  const totalInr = order.rentalPricePerDay * order.rentalDurationDays + order.deposit;
  return Math.round(totalInr * 100);
}

/**
 * Marks a Payment (and its RentalOrder) paid — called from both the
 * client-driven verify API and the webhook, either of which can arrive
 * first, or both can fire for the same payment. The `status !== "paid"`
 * transition is claimed atomically via `updateMany`'s row count, so only one
 * caller ever completes it; the other sees `alreadyProcessed: true`.
 */
export async function markRentalOrderPaid(
  paymentId: string,
  razorpayPaymentId: string,
  razorpaySignature?: string
): Promise<{ alreadyProcessed: boolean; amountInr: number }> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");

  if (payment.status === "paid") {
    return { alreadyProcessed: true, amountInr: payment.amount / 100 };
  }

  const claimed = await db.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "paid" } },
      data: {
        status: "paid",
        razorpayPaymentId,
        ...(razorpaySignature ? { razorpaySignature } : {}),
        method: "razorpay",
      },
    });
    if (result.count === 0) return false; // lost the race — the other caller already processed this payment

    await tx.rentalOrder.update({
      where: { id: payment.rentalOrderId },
      data: { paymentStatus: "paid", paymentMethod: "Razorpay" },
    });

    return true;
  });

  return { alreadyProcessed: !claimed, amountInr: payment.amount / 100 };
}

/** Marks a Payment attempt failed. The booking stays payable — Pay at Doorstep is always still available, and the customer can retry online payment. */
export async function markRentalPaymentFailed(razorpayOrderId: string, razorpayPaymentId: string): Promise<void> {
  const payment = await db.payment.findUnique({ where: { razorpayOrderId } });
  if (!payment || payment.status === "paid") return;

  await db.$transaction([
    db.payment.update({
      where: { id: payment.id },
      data: { status: "failed", razorpayPaymentId },
    }),
    db.rentalOrder.update({
      where: { id: payment.rentalOrderId },
      data: { paymentStatus: "failed" },
    }),
  ]);
}

export interface PaymentSummary {
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountInr: number;
  status: string; // created | paid | failed
  createdAt: string; // ISO
}

/** For the retailer admin view — the paid attempt if one exists, else the most recent attempt (so a failed/abandoned try is still visible). */
export async function getLatestPaymentSummary(rentalOrderId: string): Promise<PaymentSummary | null> {
  const row =
    (await db.payment.findFirst({ where: { rentalOrderId, status: "paid" }, orderBy: { createdAt: "desc" } })) ??
    (await db.payment.findFirst({ where: { rentalOrderId }, orderBy: { createdAt: "desc" } }));

  if (!row) return null;

  return {
    razorpayOrderId: row.razorpayOrderId,
    razorpayPaymentId: row.razorpayPaymentId,
    amountInr: row.amount / 100,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

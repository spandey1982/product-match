import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPaymentSignature } from "@/lib/billing/razorpay";
import { fetchExchangeRate, convertInrToUsd } from "@/lib/billing/exchange";
import type { TransactionType } from "@/lib/billing/types";

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
      return NextResponse.json(
        { error: "Missing payment verification fields" },
        { status: 400 },
      );
    }

    const isValid = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 },
      );
    }

    const paymentOrder = await db.paymentOrder.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!paymentOrder) {
      return NextResponse.json(
        { error: "Payment order not found" },
        { status: 404 },
      );
    }

    if (paymentOrder.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (paymentOrder.status === "paid") {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        amountInr: paymentOrder.amountInr,
      });
    }

    const rate = await fetchExchangeRate();
    const creditUsd = convertInrToUsd(paymentOrder.amountInr, rate);

    const result = await db.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: session.id },
        create: {
          userId: session.id,
          balanceUsd: creditUsd,
          totalCreditsUsd: creditUsd,
          status: "active",
          lastExchangeRate: rate,
        },
        update: {
          balanceUsd: { increment: creditUsd },
          totalCreditsUsd: { increment: creditUsd },
          lastExchangeRate: rate,
        },
      });

      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT" satisfies TransactionType,
          amountUsd: creditUsd,
          balanceAfter: wallet.balanceUsd,
          description: paymentOrder.description ?? `Credit top-up: ${paymentOrder.packLabel ?? "custom"}`,
          initiatedBy: `razorpay:${razorpay_payment_id}`,
          originalAmountInr: paymentOrder.amountInr,
          exchangeRate: rate,
        },
      });

      await tx.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          status: "paid",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          amountUsd: creditUsd,
          exchangeRate: rate,
          walletTransactionId: walletTx.id,
        },
      });

      return {
        creditedUsd: creditUsd,
        newBalance: wallet.balanceUsd,
        transactionId: walletTx.id,
      };
    });

    return NextResponse.json({
      success: true,
      amountInr: paymentOrder.amountInr,
      creditedUsd: result.creditedUsd,
      exchangeRate: rate,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[verify-payment]", err);
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 },
    );
  }
}

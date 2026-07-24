import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { fetchExchangeRate, convertInrToUsd } from "@/lib/billing/exchange";
import type { TransactionType } from "@/lib/billing/types";

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

async function creditWalletForOrder(
  paymentOrder: {
    id: string;
    userId: string;
    amountInr: number;
    packLabel: string | null;
    description: string | null;
  },
  razorpayPaymentId: string,
) {
  const rate = await fetchExchangeRate();
  const creditUsd = convertInrToUsd(paymentOrder.amountInr, rate);

  await db.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: paymentOrder.userId },
      create: {
        userId: paymentOrder.userId,
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
        description:
          paymentOrder.description ??
          `Credit top-up: ${paymentOrder.packLabel ?? "custom"}`,
        initiatedBy: `razorpay:${razorpayPaymentId}`,
        originalAmountInr: paymentOrder.amountInr,
        exchangeRate: rate,
      },
    });

    await tx.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: "paid",
        razorpayPaymentId,
        amountUsd: creditUsd,
        exchangeRate: rate,
        walletTransactionId: walletTx.id,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 },
      );
    }

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const { event } = payload;

    if (event === "payment.captured") {
      const payment = payload.payload.payment?.entity;
      if (!payment) {
        return NextResponse.json({ status: "ignored" });
      }

      const paymentOrder = await db.paymentOrder.findUnique({
        where: { razorpayOrderId: payment.order_id },
      });

      if (!paymentOrder) {
        console.warn("[webhook] Unknown order:", payment.order_id);
        return NextResponse.json({ status: "ignored" });
      }

      if (paymentOrder.status === "paid") {
        return NextResponse.json({ status: "already_processed" });
      }

      await creditWalletForOrder(paymentOrder, payment.id);
      return NextResponse.json({ status: "credited" });
    }

    if (event === "payment.failed") {
      const payment = payload.payload.payment?.entity;
      if (!payment) {
        return NextResponse.json({ status: "ignored" });
      }

      await db.paymentOrder.updateMany({
        where: {
          razorpayOrderId: payment.order_id,
          status: { not: "paid" },
        },
        data: {
          status: "failed",
          razorpayPaymentId: payment.id,
        },
      });

      return NextResponse.json({ status: "marked_failed" });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    console.error("[razorpay-webhook]", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

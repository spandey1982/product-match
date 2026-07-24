import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireAuth();

    const wallet = await db.wallet.findUnique({
      where: { userId: session.id },
    });

    if (!wallet) {
      return NextResponse.json({ transactions: [] });
    }

    const transactions = await db.walletTransaction.findMany({
      where: { walletId: wallet.id, type: "CREDIT" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      transactions: transactions.map((tx) => {
        const desc = tx.description.toLowerCase();
        let paymentStatus: string = "paid";
        if (desc.includes("trial") || tx.initiatedBy.startsWith("admin:")) {
          paymentStatus = "trial";
        }
        if (desc.includes("promo") || desc.includes("promotional")) {
          paymentStatus = "promo";
        }

        return {
          id: tx.id,
          amountUsd: tx.amountUsd,
          originalAmountInr: tx.originalAmountInr,
          exchangeRate: tx.exchangeRate,
          paymentStatus,
          description: tx.description,
          createdAt: tx.createdAt.toISOString(),
        };
      }),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

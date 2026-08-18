import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { findCreditPackage } from "@/lib/vto-credits/packages";

/**
 * "Purchases" a try-on credit package — Phase 1 has no live payment gateway
 * behind this (see lib/vto-credits/packages.ts), so a successful request
 * credits the customer immediately, same mocked posture as RentalOrder's
 * "Pay at Doorstep". Phase 2 wires Razorpay in front of this without
 * changing the response shape.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in to buy try-on credits." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const packageId = (body as { packageId?: unknown }).packageId;
    if (typeof packageId !== "string") {
      return NextResponse.json({ error: "packageId is required." }, { status: 400 });
    }

    const pack = findCreditPackage(packageId);
    if (!pack) {
      return NextResponse.json({ error: "Unknown credit package." }, { status: 400 });
    }

    const [customer] = await db.$transaction([
      db.customer.update({
        where: { id: session.id },
        data: { tryOnCredits: { increment: pack.credits } },
        select: { tryOnCredits: true },
      }),
      db.creditTopUp.create({
        data: { customerId: session.id, credits: pack.credits, amountPaise: pack.priceInPaise, source: "purchase" },
      }),
    ]);

    return NextResponse.json({ tryOnCredits: customer.tryOnCredits });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

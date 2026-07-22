import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { toRentalOrderDTO } from "@/lib/rental/order-db";

/** The only real (non-mocked) status transition — see lib/rental/order-mock.ts's getDisplayStatus for the rest. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const existing = await db.rentalOrder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If a session exists it must own this order. A guest order (no session
    // on either side) is allowed through at the same trust level the
    // localStorage-only version had — anyone with the link could cancel it
    // there too.
    const session = await getCustomerSession();
    if (session && session.id !== existing.customerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const order = await db.rentalOrder.update({
      where: { id },
      data: { status: "cancelled" },
    });

    return NextResponse.json({ order: toRentalOrderDTO(order) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

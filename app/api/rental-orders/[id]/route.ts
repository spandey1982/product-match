import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { toRentalOrderDTO } from "@/lib/rental/order-db";
import { ORDER_STATUSES, OrderStatus } from "@/lib/rental/order-types";

/**
 * Retailer-only status update for a rental order placed against their own
 * catalog — the one real (non-mocked) write path besides the customer's own
 * cancel action. Ownership is checked through the order's productId (a
 * durable snapshot, not a live FK) against the retailer's own products,
 * matching the same join the Rental Orders list page uses.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const status = body?.status;

    if (typeof status !== "string" || !(ORDER_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const existing = await db.rentalOrder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const product = await db.product.findFirst({
      where: { id: existing.productId, userId: session.id },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const order = await db.rentalOrder.update({
      where: { id },
      data: { status: status as OrderStatus },
    });

    return NextResponse.json({ order: toRentalOrderDTO(order) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

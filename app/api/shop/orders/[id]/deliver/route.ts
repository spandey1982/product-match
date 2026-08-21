import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toShopOrderDTO } from "@/lib/shop/order-db";

const TERMINAL_STATUSES = ["order_completed", "order_denied", "cancelled"];

/**
 * Delivery-person two-step verification action for a home-trial order —
 * app/deliver/[id]'s single write path. Deliberately unauthenticated: the
 * delivery partner is a third party with no account or store/admin access of
 * any kind, so the order's own unguessable cuid id is the only access
 * control, the same trust model already used by the customer-facing
 * /shop/orders/[id] confirmation page itself. Only ever moves a "trial"
 * order to its real terminal outcome — never touches a "buy" order or an
 * already-terminal one (no re-verification once recorded).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const outcome = body?.outcome;

    if (outcome !== "completed" && outcome !== "denied") {
      return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
    }

    const existing = await db.shopOrder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.orderType !== "trial") {
      return NextResponse.json({ error: "Not a home-trial order" }, { status: 400 });
    }
    if (TERMINAL_STATUSES.includes(existing.status)) {
      return NextResponse.json({ error: "This order's outcome has already been recorded" }, { status: 409 });
    }

    const order = await db.shopOrder.update({
      where: { id },
      data: { status: outcome === "completed" ? "order_completed" : "order_denied" },
    });

    return NextResponse.json({ order: toShopOrderDTO(order) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

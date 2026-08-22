import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { toRentalOrderDTO } from "@/lib/rental/order-db";
import { toShopOrderDTO } from "@/lib/shop/order-db";
import { ORDER_STATUSES } from "@/lib/rental/order-types";
import { SHOP_ORDER_STATUSES } from "@/lib/shop/order-types";

/**
 * Admin-only status update for the merged Orders page — resolves the id
 * against RentalOrder first, then ShopOrder (trial orders only; "buy"
 * purchases aren't part of this merged view, see lib/orders/types.ts).
 * Admin-gated rather than ownership-gated, unlike the old per-retailer
 * rental-orders route this replaces: this page lists orders across every
 * retailer, the same access model the old admin Shop Orders page already used.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const status = body?.status;
    if (typeof status !== "string") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const rental = await db.rentalOrder.findUnique({ where: { id } });
    if (rental) {
      if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const updated = await db.rentalOrder.update({ where: { id }, data: { status } });
      return NextResponse.json({ order: toRentalOrderDTO(updated) });
    }

    const shop = await db.shopOrder.findUnique({ where: { id } });
    if (shop && shop.orderType === "trial") {
      if (!(SHOP_ORDER_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const updated = await db.shopOrder.update({ where: { id }, data: { status } });
      return NextResponse.json({ order: toShopOrderDTO(updated) });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

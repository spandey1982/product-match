import { db } from "@/lib/db";
import { toRentalOrderDTO } from "@/lib/rental/order-db";
import { toShopOrderDTO } from "@/lib/shop/order-db";
import { normalizeRentalOrder, normalizeTrialOrder } from "./normalize";
import { NormalizedOrder } from "./types";

/** Matches the recent-N cap the standalone lists used before the merge. */
const TAKE_PER_SOURCE = 100;

/**
 * Merged admin order list — every RentalOrder plus every "trial" ShopOrder
 * (plain "buy" purchases excluded, see lib/orders/types.ts), most recent 100
 * combined. Platform-wide, not scoped to one retailer's own products — this
 * lives behind the admin-only Orders page, same access model the old
 * Shop Orders admin page already used.
 */
export async function getAdminOrders(): Promise<NormalizedOrder[]> {
  const [rentalRows, trialRows] = await Promise.all([
    db.rentalOrder.findMany({ orderBy: { createdAt: "desc" }, take: TAKE_PER_SOURCE }),
    db.shopOrder.findMany({
      where: { orderType: "trial" },
      orderBy: { createdAt: "desc" },
      take: TAKE_PER_SOURCE,
    }),
  ]);

  const merged = [
    ...rentalRows.map((row) => normalizeRentalOrder(toRentalOrderDTO(row))),
    ...trialRows.map((row) => normalizeTrialOrder(toShopOrderDTO(row))),
  ];

  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged.slice(0, 100);
}

/** Single-order lookup for the detail page — tries RentalOrder, then ShopOrder (trial only). */
export async function getAdminOrder(id: string): Promise<NormalizedOrder | null> {
  const rental = await db.rentalOrder.findUnique({ where: { id } });
  if (rental) return normalizeRentalOrder(toRentalOrderDTO(rental));

  const shop = await db.shopOrder.findUnique({ where: { id } });
  if (shop && shop.orderType === "trial") return normalizeTrialOrder(toShopOrderDTO(shop));

  return null;
}

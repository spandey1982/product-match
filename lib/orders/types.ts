import type { OrderStatusBadgeVariant } from "@/lib/rental/order-mock";

/**
 * The admin merged Orders page covers RentalOrder rows and "trial"
 * (home-trial) ShopOrder rows — plain "buy" purchases are deliberately out of
 * scope (they don't share a status/price/deposit shape with these two: no
 * deposit concept, and buy-only statuses like shipped/delivered don't fit the
 * Requested→...→Order Completed/Denied lifecycle this page manages).
 */
export type OrderKind = "rental" | "trial";

export const ORDER_KIND_LABEL: Record<OrderKind, string> = {
  rental: "Rental",
  trial: "Home Trial",
};

/**
 * A RentalOrder or trial ShopOrder flattened into one shape so the merged
 * list/detail pages and their status-update flow don't need to branch on
 * which source table a row came from. Built by lib/orders/normalize.ts from
 * the existing per-domain DTOs (RentalOrder / ShopOrder) — no new DB mapping.
 */
export interface NormalizedOrder {
  kind: OrderKind;
  id: string;
  createdAt: string;

  productTitle: string;
  productImage?: string | null;

  status: string;
  displayStatus: string;
  statusLabel: string;
  statusVariant: OrderStatusBadgeVariant;

  paymentMethod: string;
  paymentLabel: string;
  paymentVariant: OrderStatusBadgeVariant;

  /** Card 2's second Fact: "Estimated Delivery Window" (rental) or "Estimated Trial Window" (trial). */
  windowLabel: string;
  windowValue: string;

  /** Rental price/day for rental orders, total amount for trial orders — see ORDER_KIND_LABEL for how the list table annotates which. */
  price: number;
  priceSuffix: string;
  /** Rental orders only — null for trial orders (no deposit concept). */
  deposit: number | null;

  customer: { name: string; phone: string; email?: string };
  address: { line1: string; pincode: string; landmark?: string };

  eventDate: string;
  eventDateLabel: string;
  slot: string;
  slotLabel: string;
  specialInstructions?: string;
}

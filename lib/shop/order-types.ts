export type DeliverySlot = "morning" | "afternoon" | "evening";

/**
 * ShopOrder is deliberately buy-only — a shopper renting a product from
 * /shop uses the same RentalInfoPanel/RentalRequestModal/RentalOrder
 * pipeline /rent already has (age groups, deposit, trial window don't apply
 * to a plain purchase, and there's no reason to fork that already-working
 * flow). `orderType` stays on the row for future non-rental order kinds,
 * but the API only ever creates "buy" today.
 */
export const SHOP_ORDER_STATUSES = [
  "requested",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type ShopOrderStatus = (typeof SHOP_ORDER_STATUSES)[number];

export const SHOP_PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type ShopPaymentStatus = (typeof SHOP_PAYMENT_STATUSES)[number];

export interface ShopOrder {
  id: string;
  createdAt: string; // ISO timestamp

  orderType: "buy";

  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeName?: string | null;

  quantity: number;
  unitPrice: number;
  amountTotal: number;

  customer: {
    name: string;
    phone: string;
    email?: string;
  };

  address: {
    line1: string;
    pincode: string;
    landmark?: string;
  };

  deliverySlot?: DeliverySlot;
  specialInstructions?: string;

  /** "Pay at Doorstep" for Phase 1 — no live payment gateway wired for /shop orders yet. */
  paymentMethod: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
}

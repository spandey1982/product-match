export type DeliverySlot = "morning" | "afternoon" | "evening";

/**
 * A /shop order — either a plain "buy" purchase or a "trial" request from the
 * "Try & Buy" home-trial flow. One table, one id space: there is no separate
 * "trial" system anymore. Buy orders progress through shipped/delivered;
 * trial orders progress through out_for_trial/tried_out and land on a real,
 * delivery-verified outcome (order_completed/order_denied) instead — see
 * app/deliver/[id] for that verification step.
 */
export const SHOP_ORDER_STATUSES = [
  "requested",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "out_for_trial",
  "tried_out",
  "order_completed",
  "order_denied",
  "cancelled",
] as const;
export type ShopOrderStatus = (typeof SHOP_ORDER_STATUSES)[number];

/** Cosmetic auto-progression stages for a trial order's pre-verification lifecycle — excludes the real-only terminal branches (order_completed/order_denied/cancelled). */
export const TRIAL_LIFECYCLE_STAGES: ShopOrderStatus[] = [
  "requested",
  "confirmed",
  "preparing",
  "out_for_trial",
  "tried_out",
];

export const SHOP_PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type ShopPaymentStatus = (typeof SHOP_PAYMENT_STATUSES)[number];

export interface ShopOrder {
  id: string;
  createdAt: string; // ISO timestamp

  orderType: "buy" | "trial";

  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeName?: string | null;
  /** Trial orders only. */
  size?: string | null;

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

  /** Buy orders only. */
  deliverySlot?: DeliverySlot;
  /** Trial orders only — yyyy-mm-dd, directly chosen. */
  trialDate?: string;
  /** Trial orders only. */
  trialSlot?: DeliverySlot;
  specialInstructions?: string;

  /** "Pay at Doorstep" for Phase 1 — no live payment gateway wired for /shop orders yet. */
  paymentMethod: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
}

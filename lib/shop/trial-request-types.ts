export type TrialSlot = "morning" | "afternoon" | "evening";

/**
 * Home-trial lifecycle. "sold" is a real terminal branch set only by a
 * future payment-confirmation action (not yet implemented — see memory
 * "shop-trial-payment-confirmation-deferred") — never by the cosmetic
 * display-status simulation in trial-request-mock.ts. "cancelled" is the
 * other real terminal branch, same posture.
 */
export const TRIAL_STATUSES = [
  "requested",
  "confirmed",
  "preparing",
  "out_for_trial",
  "tried_out",
  "sold",
  "cancelled",
] as const;

export type TrialStatus = (typeof TRIAL_STATUSES)[number];

/** Cosmetic auto-progression stages — excludes "sold" and "cancelled", both real-only branches. */
export const TRIAL_LIFECYCLE_STAGES: TrialStatus[] = TRIAL_STATUSES.filter(
  (s): s is Exclude<TrialStatus, "sold" | "cancelled"> => s !== "sold" && s !== "cancelled"
);

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** A home-trial request placed via /shop's "Try & Buy" — persisted in Postgres (ShopTrialRequest). */
export interface ShopTrialRequestDTO {
  id: string;
  createdAt: string; // ISO timestamp

  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeName?: string | null;
  price: number;
  size?: string | null;

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

  trialDate: string; // ISO date (yyyy-mm-dd), directly chosen
  trialSlot: TrialSlot;
  specialInstructions?: string;

  paymentMethod: "Pay at Doorstep" | "Razorpay";
  status: TrialStatus;
  paymentStatus: PaymentStatus;
}

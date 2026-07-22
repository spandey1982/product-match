import { AgeGroup } from "./types";

export type DeliverySlot = "morning" | "afternoon" | "evening";

/** Full rental lifecycle. "cancelled" is the only status a real user action sets — the rest are mocked progression (see order-mock.ts's getDisplayStatus). */
export const ORDER_STATUSES = [
  "requested",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "trial",
  "delivered",
  "pickup_scheduled",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Ordered lifecycle (excludes "cancelled", which is a real terminal branch, not a stage). */
export const LIFECYCLE_STAGES: OrderStatus[] = ORDER_STATUSES.filter(
  (s): s is Exclude<OrderStatus, "cancelled"> => s !== "cancelled"
);

/**
 * A mocked rental request — persisted client-side only (localStorage), not
 * in the database. No auth, no payment; this just captures intent to rent.
 */
export interface RentalOrder {
  id: string;
  createdAt: string; // ISO timestamp

  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeName?: string | null;

  ageGroup: AgeGroup;
  rentalPricePerDay: number;
  deposit: number;
  rentalDurationDays: number;

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

  eventDate: string; // ISO date (yyyy-mm-dd)
  deliverySlot: DeliverySlot;
  specialInstructions?: string;

  deliveryDate: string; // ISO date, computed
  expectedTrialWindow: string; // display string, computed

  paymentMethod: "Pay at Doorstep";
  /** Set at creation ("requested") or by the real Cancel action ("cancelled"). Any other value is only ever written by getDisplayStatus's mock progression, never stored. */
  status: OrderStatus;
}

import { AgeGroup } from "./types";

export type DeliverySlot = "morning" | "afternoon" | "evening";

/**
 * Full rental lifecycle. The customer can set "cancelled"; a retailer can set
 * any stage from the Rental Orders admin page. Until either happens, the
 * order stays "requested" in storage and getDisplayStatus mocks progression
 * through LIFECYCLE_STAGES for display purposes only (see order-mock.ts).
 */
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
  /** Set at creation ("requested"), by the customer's Cancel action ("cancelled"), or by a retailer manually advancing it from the Rental Orders admin page. */
  status: OrderStatus;
}

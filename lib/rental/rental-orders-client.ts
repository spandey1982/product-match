import { AgeGroup } from "./types";
import { DeliverySlot, RentalOrder } from "./order-types";

export interface CreateRentalOrderInput {
  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeName?: string | null;
  ageGroup: AgeGroup;
  rentalPricePerDay: number;
  deposit: number;
  rentalDurationDays: number;
  name: string;
  phone: string;
  email?: string;
  /** Either an existing saved address id... */
  addressId?: string;
  /** ...or a freshly typed one (persisted as a new address server-side). */
  address?: string;
  pincode?: string;
  landmark?: string;
  eventDate: string;
  deliverySlot: DeliverySlot;
  specialInstructions?: string;
  deliveryDate: string;
  expectedTrialWindow: string;
}

/**
 * Rental orders now live in Postgres (RentalOrder), not localStorage — these
 * are thin fetch wrappers around the backend. Reading a single/list of
 * orders happens server-side in the relevant page.tsx (Prisma directly);
 * these two are the only client-triggered mutations (create + cancel).
 */
export async function createRentalOrder(input: CreateRentalOrderInput): Promise<RentalOrder> {
  const res = await fetch("/api/customer/rental-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not submit rental request");
  return data.order as RentalOrder;
}

export async function cancelRentalOrder(id: string): Promise<RentalOrder> {
  const res = await fetch(`/api/customer/rental-orders/${id}/cancel`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not cancel this request");
  return data.order as RentalOrder;
}

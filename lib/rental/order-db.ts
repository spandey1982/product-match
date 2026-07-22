import { RentalOrder, DeliverySlot } from "./order-types";
import { AgeGroup } from "./types";

/** Shape of a raw RentalOrder row from Prisma — kept separate from the Prisma import so this stays a plain server-side mapping module. */
export interface RentalOrderRow {
  id: string;
  createdAt: Date;
  productId: string;
  productTitle: string;
  productImage: string | null;
  storeName: string | null;
  ageGroup: string;
  rentalPricePerDay: number;
  deposit: number;
  rentalDurationDays: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  addressLine1: string;
  addressPincode: string;
  addressLandmark: string | null;
  eventDate: string;
  deliverySlot: string;
  specialInstructions: string | null;
  deliveryDate: string;
  expectedTrialWindow: string;
  paymentMethod: string;
  status: string;
}

/** Flattened DB columns <-> the nested RentalOrder shape the UI already expects — keeps the schema simple (no JSON columns) without touching every consumer. */
export function toRentalOrderDTO(row: RentalOrderRow): RentalOrder {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    productId: row.productId,
    productTitle: row.productTitle,
    productImage: row.productImage,
    storeName: row.storeName,
    ageGroup: row.ageGroup as AgeGroup,
    rentalPricePerDay: row.rentalPricePerDay,
    deposit: row.deposit,
    rentalDurationDays: row.rentalDurationDays,
    customer: {
      name: row.customerName,
      phone: row.customerPhone,
      email: row.customerEmail ?? undefined,
    },
    address: {
      line1: row.addressLine1,
      pincode: row.addressPincode,
      landmark: row.addressLandmark ?? undefined,
    },
    eventDate: row.eventDate,
    deliverySlot: row.deliverySlot as DeliverySlot,
    specialInstructions: row.specialInstructions ?? undefined,
    deliveryDate: row.deliveryDate,
    expectedTrialWindow: row.expectedTrialWindow,
    paymentMethod: row.paymentMethod as RentalOrder["paymentMethod"],
    status: row.status as RentalOrder["status"],
  };
}

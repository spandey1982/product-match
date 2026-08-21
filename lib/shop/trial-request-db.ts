import { ShopTrialRequestDTO, TrialSlot, TrialStatus, PaymentStatus } from "./trial-request-types";

/** Shape of a raw ShopTrialRequest row from Prisma — kept separate from the Prisma import so this stays a plain server-side mapping module. */
export interface ShopTrialRequestRow {
  id: string;
  createdAt: Date;
  productId: string;
  productTitle: string;
  productImage: string | null;
  storeName: string | null;
  price: number;
  size: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  addressLine1: string;
  addressPincode: string;
  addressLandmark: string | null;
  trialDate: string;
  trialSlot: string;
  specialInstructions: string | null;
  paymentMethod: string;
  status: string;
  paymentStatus: string;
}

/** Flattened DB columns <-> the nested ShopTrialRequestDTO shape the UI expects. */
export function toShopTrialRequestDTO(row: ShopTrialRequestRow): ShopTrialRequestDTO {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    productId: row.productId,
    productTitle: row.productTitle,
    productImage: row.productImage,
    storeName: row.storeName,
    price: row.price,
    size: row.size,
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
    trialDate: row.trialDate,
    trialSlot: row.trialSlot as TrialSlot,
    specialInstructions: row.specialInstructions ?? undefined,
    paymentMethod: row.paymentMethod as ShopTrialRequestDTO["paymentMethod"],
    status: row.status as TrialStatus,
    paymentStatus: row.paymentStatus as PaymentStatus,
  };
}

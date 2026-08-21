import { ShopOrder, DeliverySlot, ShopOrderStatus, ShopPaymentStatus } from "./order-types";

/** Shape of a raw ShopOrder row from Prisma — kept separate from the Prisma import so this stays a plain server-side mapping module. */
export interface ShopOrderRow {
  id: string;
  createdAt: Date;
  orderType: string;
  productId: string;
  productTitle: string;
  productImage: string | null;
  storeName: string | null;
  size: string | null;
  quantity: number;
  unitPrice: number;
  amountTotal: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  addressLine1: string;
  addressPincode: string;
  addressLandmark: string | null;
  deliverySlot: string | null;
  trialDate: string | null;
  trialSlot: string | null;
  specialInstructions: string | null;
  paymentMethod: string;
  status: string;
  paymentStatus: string;
}

export function toShopOrderDTO(row: ShopOrderRow): ShopOrder {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    orderType: row.orderType as ShopOrder["orderType"],
    productId: row.productId,
    productTitle: row.productTitle,
    productImage: row.productImage,
    storeName: row.storeName,
    size: row.size,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    amountTotal: row.amountTotal,
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
    deliverySlot: (row.deliverySlot as DeliverySlot) ?? undefined,
    trialDate: row.trialDate ?? undefined,
    trialSlot: (row.trialSlot as DeliverySlot) ?? undefined,
    specialInstructions: row.specialInstructions ?? undefined,
    paymentMethod: row.paymentMethod,
    status: row.status as ShopOrderStatus,
    paymentStatus: row.paymentStatus as ShopPaymentStatus,
  };
}

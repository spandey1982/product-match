import { DeliverySlot, ShopOrder } from "./order-types";

export interface CreateShopOrderInput {
  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeName?: string | null;
  unitPrice: number;
  name: string;
  phone: string;
  email?: string;
  /** Either an existing saved address id... */
  addressId?: string;
  /** ...or a freshly typed one (persisted as a new address server-side). */
  address?: string;
  pincode?: string;
  landmark?: string;
  deliverySlot: DeliverySlot;
  specialInstructions?: string;
}

export async function createShopOrder(input: CreateShopOrderInput): Promise<ShopOrder> {
  const res = await fetch("/api/shop/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not place your order");
  return data.order as ShopOrder;
}

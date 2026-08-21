import { TrialSlot, ShopTrialRequestDTO } from "./trial-request-types";

export interface CreateShopTrialRequestInput {
  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeName?: string | null;
  price: number;
  size?: string | null;
  name: string;
  phone: string;
  email?: string;
  /** Either an existing saved address id... */
  addressId?: string;
  /** ...or a freshly typed one (persisted as a new address server-side). */
  address?: string;
  pincode?: string;
  landmark?: string;
  trialDate: string;
  trialSlot: TrialSlot;
  specialInstructions?: string;
}

/** Thin fetch wrapper — mirrors lib/rental/rental-orders-client.ts's createRentalOrder. */
export async function createShopTrialRequest(input: CreateShopTrialRequestInput): Promise<ShopTrialRequestDTO> {
  const res = await fetch("/api/customer/shop-trial-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not submit your home trial request");
  return data.trialRequest as ShopTrialRequestDTO;
}

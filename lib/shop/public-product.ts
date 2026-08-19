import { deserializeProduct } from "@/lib/serialize";
import { Product } from "@/types";

export type PublicShopProduct = Product & {
  storeName: string | null;
  storePhone: string | null;
  storeAddress: string | null;
  storeCity: string | null;
  /** Straight-line km from the shopper's resolved location to the store's city center — null when no shopper location was supplied. */
  distanceKm: number | null;
};

/**
 * Maps a raw DB product (query `include`-ing `user: { select: { storeName, storePhone, storeAddress, storeCity } }`)
 * to the shape sent over /api/public/products. Generalizes
 * lib/rental/public-product.ts's toPublicRentalProduct — /shop spans every
 * active product (buy or rent), not just isForRent ones, so it gets its own
 * mapper rather than overloading the rental-specific one. Drops the internal
 * userId, same reasoning as the rental mapper: the marketplace spans every
 * retailer, so callers get storeName for display instead of a foreign key.
 */
export function toPublicShopProduct(
  raw: Record<string, unknown> & {
    user?: {
      storeName: string | null;
      storePhone?: string | null;
      storeAddress?: string | null;
      storeCity?: string | null;
    } | null;
  },
  distanceKm: number | null = null
): PublicShopProduct {
  const product = deserializeProduct(raw) as unknown as Product;
  return {
    ...product,
    userId: "",
    storeName: raw.user?.storeName ?? null,
    storePhone: raw.user?.storePhone ?? null,
    storeAddress: raw.user?.storeAddress ?? null,
    storeCity: raw.user?.storeCity ?? null,
    distanceKm,
  };
}

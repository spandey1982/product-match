import { deserializeProduct } from "@/lib/serialize";
import { Product } from "@/types";

export type PublicRentalProduct = Product & {
  storeName: string | null;
  storePhone: string | null;
  storeAddress: string | null;
};

/**
 * Maps a raw DB product (as returned by a query `include`-ing `user: { select: { storeName } }`)
 * to the shape sent over the public rental API. Drops the internal userId —
 * the public marketplace spans every retailer, so callers get `storeName`
 * for display instead of an internal foreign key. `storePhone`/`storeAddress`
 * default to null for callers (e.g. the list/search routes) that don't select
 * them — those fields are only needed on the single-product detail view.
 */
export function toPublicRentalProduct(
  raw: Record<string, unknown> & {
    user?: { storeName: string | null; storePhone?: string | null; storeAddress?: string | null } | null;
  }
): PublicRentalProduct {
  const product = deserializeProduct(raw) as unknown as Product;
  return {
    ...product,
    userId: "",
    storeName: raw.user?.storeName ?? null,
    storePhone: raw.user?.storePhone ?? null,
    storeAddress: raw.user?.storeAddress ?? null,
  };
}

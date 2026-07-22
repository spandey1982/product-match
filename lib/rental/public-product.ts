import { deserializeProduct } from "@/lib/serialize";
import { Product } from "@/types";

export type PublicRentalProduct = Product & { storeName: string | null };

/**
 * Maps a raw DB product (as returned by a query `include`-ing `user: { select: { storeName } }`)
 * to the shape sent over the public rental API. Drops the internal userId —
 * the public marketplace spans every retailer, so callers get `storeName`
 * for display instead of an internal foreign key.
 */
export function toPublicRentalProduct(
  raw: Record<string, unknown> & { user?: { storeName: string | null } | null }
): PublicRentalProduct {
  const product = deserializeProduct(raw) as unknown as Product;
  return { ...product, userId: "", storeName: raw.user?.storeName ?? null };
}

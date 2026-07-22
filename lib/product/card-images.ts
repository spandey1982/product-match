import { Product } from "@/types";
import { thumbnailUrl } from "@/lib/images/variants";
import { framedImageUrl } from "@/lib/image-normalize";

/** "pallu" → "Pallu", "front" → "Front" — a friendly label for a view id. */
function prettyView(view: string): string {
  return view
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Ordered thumbnail list for grid cards (catalog + rental): the synthesized
 * on-model shot (skipped if a "front" generated image already covers it),
 * then all generated views, then the retailer's raw upload last.
 */
export function getProductCardImages(product: Product): string[] {
  return [
    product.modelImageUrl && !product.generatedImages?.some((gi) => gi.view === "front")
      ? thumbnailUrl(framedImageUrl(product.modelImageUrl, "on-model"))
      : null,
    ...(product.generatedImages?.map((gi) => thumbnailUrl(framedImageUrl(gi.url, gi.view))) ?? []),
    product.imageUrl ? thumbnailUrl(product.imageUrl) : null,
  ].filter(Boolean) as string[];
}

/**
 * Labels paired 1:1 with getProductCardImages()'s output — kept alongside it
 * so the two orderings can never drift apart.
 */
export function getProductCardImageLabels(product: Product): string[] {
  return [
    product.modelImageUrl && !product.generatedImages?.some((gi) => gi.view === "front")
      ? "On model"
      : null,
    ...(product.generatedImages?.map((gi) => (gi.view === "on-model" ? "On model" : prettyView(gi.view))) ?? []),
    product.imageUrl ? "Product" : null,
  ].filter(Boolean) as string[];
}

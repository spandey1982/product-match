import { Product } from "@/types";
import { thumbnailUrl } from "@/lib/images/variants";
import { framedImageUrl } from "@/lib/image-normalize";

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

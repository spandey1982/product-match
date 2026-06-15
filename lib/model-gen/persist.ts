/**
 * Persist generated images additively.
 *
 * Inserts one ProductImage row per generated view, and keeps the legacy
 * Product.modelImageUrl pointing at the primary image so existing UI (product
 * detail, Instagram share) keeps working unchanged. No existing column is
 * removed or repurposed.
 */
import { db } from "@/lib/db";
import type { GenerationObjective } from "./objectives";

export interface GeneratedImage {
  url: string;
  view: string;
}

/** Pick the primary image: a "front" view if present, else the first one. */
function primaryIndex(images: GeneratedImage[]): number {
  const front = images.findIndex((i) => i.view === "front");
  return front >= 0 ? front : 0;
}

export async function persistGeneratedImages(
  productId: string,
  images: GeneratedImage[],
  objective: GenerationObjective
): Promise<void> {
  if (images.length === 0) return;

  const primary = primaryIndex(images);

  for (let i = 0; i < images.length; i++) {
    await db.productImage.create({
      data: {
        productId,
        url: images[i].url,
        view: images[i].view,
        objective,
        isPrimary: i === primary,
      },
    });
  }

  // Keep the legacy single-image field on the primary, for unchanged UI.
  const primaryUrl = images[primary].url;
  await db.$executeRaw`UPDATE products SET "modelImageUrl" = ${primaryUrl}, "updatedAt" = datetime('now') WHERE id = ${productId}`;
}

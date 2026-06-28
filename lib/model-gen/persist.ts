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
  /** Backend that produced it ("gemini" | "vertex"); for perf tracking. */
  provider?: string;
  /**
   * How the card was sourced: a real AI generation ("ai-base"), a crop of one
   * ("model-crop"), or the retailer's enhanced uploaded image ("upload"). Used
   * to record/review only the actual generations, not derived/uploaded cards.
   */
  source?: "ai-base" | "model-crop" | "upload";
  /** Image facts for analytics — base shots only; null/undefined for crops. */
  modelName?: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
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
  // Typed Prisma update (updatedAt is @updatedAt, set automatically) — the
  // previous raw query used SQLite's datetime('now'), invalid on Postgres.
  await db.product.update({
    where: { id: productId },
    data: { modelImageUrl: images[primary].url },
  });
}

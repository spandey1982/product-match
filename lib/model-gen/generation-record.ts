/**
 * Generation performance/quality recording (Phase E).
 *
 * Writes one GenerationRecord per generated image — a durable, queryable
 * snapshot (provider, category, objective, view, output) used for performance
 * analytics and as the row that AI review (Phase F) and manual review (Phase G)
 * scores attach to. Non-blocking and non-fatal: a logging failure must never
 * break image generation.
 */
import { db } from "@/lib/db";
import type { GenerationObjective } from "./objectives";
import type { GeneratedImage } from "./persist";

export async function recordGenerations(params: {
  productId: string;
  userId: string;
  category: string;
  objective: GenerationObjective;
  /** Provider to record when an image isn't individually tagged. */
  defaultProvider: string;
  images: GeneratedImage[];
}): Promise<void> {
  if (params.images.length === 0) return;
  try {
    await db.generationRecord.createMany({
      data: params.images.map((img) => ({
        productId: params.productId,
        userId: params.userId,
        provider: img.provider ?? params.defaultProvider,
        category: params.category,
        objective: params.objective,
        view: img.view,
        outputUrl: img.url,
      })),
    });
  } catch (err) {
    console.error("[generation-record] failed to record:", err);
  }
}

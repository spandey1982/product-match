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

/** A persisted generation record — enough to attach a review to it. */
export interface RecordedGeneration {
  id: string;
  outputUrl: string;
  view: string;
}

export async function recordGenerations(params: {
  productId: string;
  userId: string;
  category: string;
  objective: GenerationObjective;
  /** Provider to record when an image isn't individually tagged. */
  defaultProvider: string;
  images: GeneratedImage[];
  /** Scenic Collection metadata for this generation; null when Studio was used. */
  sceneMeta?: { sceneId: string; intensity: string; density: string } | null;
}): Promise<RecordedGeneration[]> {
  if (params.images.length === 0) return [];
  const created: RecordedGeneration[] = [];
  try {
    // Create individually (not createMany) so we get ids back to attach reviews.
    for (const img of params.images) {
      const rec = await db.generationRecord.create({
        data: {
          productId: params.productId,
          userId: params.userId,
          provider: img.provider ?? params.defaultProvider,
          modelName: img.modelName ?? null,
          category: params.category,
          objective: params.objective,
          view: img.view,
          outputUrl: img.url,
          width: img.width ?? null,
          height: img.height ?? null,
          fileSizeBytes: img.bytes ?? null,
          sceneId: params.sceneMeta?.sceneId ?? null,
          sceneIntensity: params.sceneMeta?.intensity ?? null,
          sceneDensity: params.sceneMeta?.density ?? null,
        },
        select: { id: true, outputUrl: true, view: true },
      });
      created.push(rec);
    }
  } catch (err) {
    console.error("[generation-record] failed to record:", err);
  }
  return created;
}

/**
 * Garment Intelligence service — the "extract once, reuse everywhere" layer.
 *
 * The only entry point consumers use. Resolution order:
 *   1. Cached row for this product whose analyzedImageUrl still matches the
 *      product's current image → returned with zero AI calls.
 *   2. Otherwise run the hierarchical analysis once, render the prompt
 *      fragment, upsert the row, return it.
 *   3. Any failure → null. Callers treat intelligence as an enhancement,
 *      never a dependency (generation falls back to detail-notes v1).
 *
 * Feature-gated by ENABLE_GARMENT_INTELLIGENCE (default OFF) so shipping this
 * branch changes nothing until the flag is deliberately turned on.
 */
import { db } from "@/lib/db";
import { fetchProductImageBuffer } from "@/lib/generate-model-image";
import { analyzeGarment, GARMENT_INTELLIGENCE_MODEL } from "./analyze";
import { renderPromptNotes } from "./render";
import type { GarmentIntelligence, GarmentIntelligenceRecord } from "./types";

export function isGarmentIntelligenceEnabled(): boolean {
  return process.env.ENABLE_GARMENT_INTELLIGENCE === "true";
}

export interface GarmentIntelligenceContext {
  storeId?: string | null;
  userId?: string | null;
}

function parseStored(data: string): GarmentIntelligence | null {
  try {
    const parsed = JSON.parse(data) as GarmentIntelligence;
    return parsed && parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Return the product's garment intelligence, extracting + persisting it first
 * when absent or stale. Null when unavailable for any reason (disabled flag is
 * NOT checked here — callers gate themselves so an explicit admin/R&D request
 * can always force an analysis).
 */
export async function ensureGarmentIntelligence(
  productId: string,
  ctx: GarmentIntelligenceContext = {}
): Promise<GarmentIntelligenceRecord | null> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, category: true, imageUrl: true },
  });
  if (!product?.imageUrl) return null;

  // 1. Fresh cache hit — the reuse path every repeat consumer lands on.
  const cached = await db.garmentIntelligence.findUnique({ where: { productId } });
  if (cached && cached.analyzedImageUrl === product.imageUrl) {
    const intelligence = parseStored(cached.data);
    if (intelligence) {
      return {
        intelligence,
        promptNotes: cached.promptNotes,
        model: cached.model,
        analyzedImageUrl: cached.analyzedImageUrl,
      };
    }
    // Unparseable/old-version row → fall through and re-analyze.
  }

  // 2. One-time analysis (or re-analysis after an image change).
  const source = await fetchProductImageBuffer(product.imageUrl);
  if (!source) return null;

  const intelligence = await analyzeGarment({
    buffer: source.buffer,
    mime: source.mime,
    category: product.category,
    productId: product.id,
    storeId: ctx.storeId ?? null,
    userId: ctx.userId ?? null,
  });
  if (!intelligence) return null;

  const promptNotes = renderPromptNotes(intelligence);
  const data = JSON.stringify(intelligence);

  try {
    await db.garmentIntelligence.upsert({
      where: { productId },
      create: {
        productId,
        data,
        promptNotes,
        analyzedImageUrl: product.imageUrl,
        model: GARMENT_INTELLIGENCE_MODEL,
      },
      update: {
        data,
        promptNotes,
        analyzedImageUrl: product.imageUrl,
        model: GARMENT_INTELLIGENCE_MODEL,
        version: 1,
      },
    });
  } catch (err) {
    // Persistence failure shouldn't waste the analysis we just paid for.
    console.error("[garment-intelligence] persist failed:", err);
  }

  return {
    intelligence,
    promptNotes,
    model: GARMENT_INTELLIGENCE_MODEL,
    analyzedImageUrl: product.imageUrl,
  };
}

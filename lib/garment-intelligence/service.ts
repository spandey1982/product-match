/**
 * Garment Intelligence service — the "extract once, reuse everywhere" layer.
 *
 * The only entry point consumers use. Resolution order:
 *   1. Cached row for this product whose analyzedImageUrl (and back image URL)
 *      still match the product's current images → returned with zero AI calls.
 *   2. Otherwise run the hierarchical analysis once — front overview + one
 *      batched close-up call (retailer part photos first, ROI crops filling
 *      the rest) + one back call when a back image exists — render the prompt
 *      fragments, upsert the row, return it.
 *   3. Any failure → null. Callers treat intelligence as an enhancement,
 *      never a dependency.
 *
 * Feature-gated by ENABLE_GARMENT_INTELLIGENCE (default OFF) so shipping this
 * branch changes nothing until the flag is deliberately turned on.
 */
import { db } from "@/lib/db";
import { fetchProductImageBuffer } from "@/lib/generate-model-image";
import { parsePartImages, findBackPart } from "@/lib/product/part-slots";
import { analyzeGarment, analyzeGarmentBack, GARMENT_INTELLIGENCE_MODEL } from "./analyze";
import { renderPromptNotes, renderBackPromptNotes } from "./render";
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
    // Version-strict: older shapes (v1 — no back analysis, no length capture)
    // fall through to a fresh analysis rather than serving stale structure.
    return parsed && parsed.version === 2 ? parsed : null;
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
    select: { id: true, category: true, imageUrl: true, backImageUrl: true, partImages: true },
  });
  if (!product?.imageUrl) return null;

  // Back image: an uploaded "back" part slot wins, legacy backImageUrl second —
  // same resolution the generation engine uses (findBackPart is shared).
  const parts = parsePartImages(product.partImages);
  const backPart = findBackPart(parts);
  const backImageUrl = backPart?.url ?? product.backImageUrl ?? null;

  // 1. Fresh cache hit — the reuse path every repeat consumer lands on.
  //    Valid only while BOTH source images are unchanged (null-safe compare).
  const cached = await db.garmentIntelligence.findUnique({ where: { productId } });
  if (
    cached &&
    cached.analyzedImageUrl === product.imageUrl &&
    (cached.analyzedBackImageUrl ?? null) === backImageUrl
  ) {
    const intelligence = parseStored(cached.data);
    if (intelligence) {
      return {
        intelligence,
        promptNotes: cached.promptNotes,
        backPromptNotes: cached.backPromptNotes ?? null,
        model: cached.model,
        analyzedImageUrl: cached.analyzedImageUrl,
      };
    }
    // Unparseable/old-version row → fall through and re-analyze.
  }

  // 2. One-time analysis (or re-analysis after an image change).
  const source = await fetchProductImageBuffer(product.imageUrl);
  if (!source) return null;

  const analyzeCtx = {
    category: product.category,
    productId: product.id,
    storeId: ctx.storeId ?? null,
    userId: ctx.userId ?? null,
  };

  // Retailer detail close-ups (extraction-only, never sent to the generator).
  // The back part is excluded here — it is the back-analysis input, not
  // front close-up evidence.
  const partImages: Array<{ buffer: Buffer; mime: string; label: string }> = [];
  for (const p of parts.filter((x) => x !== backPart).slice(0, 4)) {
    const buf = await fetchProductImageBuffer(p.url);
    if (buf) partImages.push({ buffer: buf.buffer, mime: buf.mime, label: p.label || p.slot });
  }

  const intelligence = await analyzeGarment({
    buffer: source.buffer,
    mime: source.mime,
    partImages,
    ...analyzeCtx,
  });
  if (!intelligence) return null;

  // Back analysis (one extra call, only when a back image exists).
  let backPromptNotes: string | null = null;
  if (backImageUrl) {
    const backSource = await fetchProductImageBuffer(backImageUrl);
    if (backSource) {
      const back = await analyzeGarmentBack({
        buffer: backSource.buffer,
        mime: backSource.mime,
        ...analyzeCtx,
      });
      if (back) {
        intelligence.back = back;
        backPromptNotes = renderBackPromptNotes(back);
      }
    }
  }

  const promptNotes = renderPromptNotes(intelligence);
  const data = JSON.stringify(intelligence);

  try {
    await db.garmentIntelligence.upsert({
      where: { productId },
      create: {
        productId,
        data,
        promptNotes,
        backPromptNotes,
        analyzedImageUrl: product.imageUrl,
        analyzedBackImageUrl: backImageUrl,
        model: GARMENT_INTELLIGENCE_MODEL,
        version: 2,
      },
      update: {
        data,
        promptNotes,
        backPromptNotes,
        analyzedImageUrl: product.imageUrl,
        analyzedBackImageUrl: backImageUrl,
        model: GARMENT_INTELLIGENCE_MODEL,
        version: 2,
      },
    });
  } catch (err) {
    // Persistence failure shouldn't waste the analysis we just paid for.
    console.error("[garment-intelligence] persist failed:", err);
  }

  return {
    intelligence,
    promptNotes,
    backPromptNotes,
    model: GARMENT_INTELLIGENCE_MODEL,
    analyzedImageUrl: product.imageUrl,
  };
}

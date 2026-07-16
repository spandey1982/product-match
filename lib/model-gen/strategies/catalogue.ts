/**
 * Catalogue / Social strategy — multiple catalogue-ready images.
 *
 * Generates two BASE model shots (Front Full, Back Full) via the selected
 * provider, each seeded with the matching front/back reference model, then
 * DERIVES category-specific close-ups by cropping configured regions of those
 * base shots (crop-templates). Yields the per-category sets (saree 5, lehenga 4,
 * others 3) with only two generation calls. Pure: returns URLs; engine persists.
 *
 * Provider: "gemini" (Natural Drape, prompt-based) or "vertex" (Sharp Fit, VTO
 * with the reference as the person). Per-view capability fallback to Gemini when
 * Vertex is unavailable or a profile reference is missing.
 */
import { fetchProductImageBuffer, runGeminiImageGen } from "@/lib/generate-model-image";
import { generateTryOnVertex, isVertexTryOnEnabled, getVertexConfig } from "@/lib/tryon-vertex";
import type { TryOnMimeType } from "@/lib/tryon";
import { resolvePromptSet, buildViewPrompt } from "../prompt-sets";
import { resolveReferenceVariant } from "../reference-selection";
import { loadReferenceImage, type ModelType, type ReferenceImage } from "../reference-models";
import { sampleStudioColor } from "../studio-anchor";
import { resolveCatalogueStack } from "../catalogue-cards";
import { genReferencesFor, type PartImage } from "@/lib/product/part-slots";
import type { GeneratedImage } from "../persist";
import type { GenerationQuality } from "../quality";

export interface StrategyProduct {
  id: string;
  title: string;
  category: string;
  color: string;
  gender: string;
  imageUrl: string;
  /** Optional back-of-product image — used for the back base shot when present. */
  backImageUrl?: string | null;
  /** Front-image generation detail hints (prompt enrichment); null when unavailable. */
  detailNotes?: string | null;
  /** Back-image detail hints — used only for the back-view prompt. */
  backDetailNotes?: string | null;
}

export type CatalogueBackend = "gemini" | "vertex";

interface BaseShot {
  url: string;
  provider: CatalogueBackend;
  model: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
}

export async function runCatalogueStrategy(opts: {
  product: StrategyProduct;
  modelType: ModelType;
  /** Resolved backend (auto already resolved to a concrete provider). */
  provider?: CatalogueBackend;
  /** Retailer who owns the product — for AI cost attribution. */
  userId?: string;
  /** Studio backdrop fragment, identical for every view (studio consistency). */
  backdrop: string;
  /** Uploaded detail images — sourced into the catalogue card stack (R2). */
  partImages?: PartImage[];
  /** Native Gemini output quality for this run. Defaults to "standard". */
  quality?: GenerationQuality;
}): Promise<{ images: GeneratedImage[] }> {
  const { product, modelType, provider = "gemini", userId, backdrop, partImages = [], quality } = opts;
  // Same store + acting user for every call in this run; feature is "catalogue".
  const usage = { feature: "catalogue", storeId: userId ?? null, userId: userId ?? null };
  // Region image conditioning (R&D) — feed labelled part uploads (pallu/border)
  // to the generator as visual references. Default OFF; independent of GI so it
  // can be A/B'd on its own.
  const regionConditioningEnabled = process.env.ENABLE_REGION_CONDITIONING === "true";

  const source = await fetchProductImageBuffer(product.imageUrl);
  if (!source) return { images: [] };

  // Optional back-of-product image → used for the back base shot so the back
  // profile is generated from real data instead of being invented. Falls back
  // to the front image when not provided (current behaviour).
  const backSource = product.backImageUrl
    ? await fetchProductImageBuffer(product.backImageUrl)
    : null;

  const variant = resolveReferenceVariant(product.category);
  // Load front + back reference profiles once; each gracefully falls back to the
  // legacy single image, then to the basic model, then to null.
  const frontRef = await loadReferenceImage(modelType, variant, { profile: "front" });
  const backRef = await loadReferenceImage(modelType, variant, { profile: "back" });

  const vertexReady = isVertexTryOnEnabled() && getVertexConfig() !== null;

  // Base shots: the Front + Back full views from the category's prompt set.
  const baseViews = resolvePromptSet(product.category).filter(
    (v) => v.id === "front" || v.id === "back"
  );

  const baseShots: Partial<Record<"front" | "back", BaseShot>> = {};
  // Minimal background data from the first (front) shot — pins later views to its
  // realized backdrop colour without re-sending the whole image. Non-fatal.
  let studioAnchor: string | null = null;

  /** Generate one base shot via the chosen provider, with Gemini fallback. */
  async function generateBaseShot(
    viewId: "front" | "back",
    promptText: string,
    reference: ReferenceImage | null,
    productSource: { buffer: Buffer; mime: string },
    productUrl: string,
    extraReferences: Array<{ buffer: Buffer; mime: string; label: string }> = []
  ): Promise<BaseShot | null> {
    // Vertex (Sharp Fit): VTO with the reference model as the person. Needs a
    // reference; back views need the back reference. Falls back to Gemini.
    if (provider === "vertex" && vertexReady && reference) {
      try {
        const res = await generateTryOnVertex({
          productImageUrl: productUrl,
          userPhotoBuffer: reference.buffer,
          userPhotoMimeType: reference.mime as TryOnMimeType,
          productCategory: product.category,
          productColor: product.color,
          productId: product.id,
          productTitle: product.title,
          userId: "model-gen",
          usage,
        });
        return {
          url: res.url,
          provider: "vertex",
          model: res.model ?? null,
          width: res.width ?? null,
          height: res.height ?? null,
          bytes: res.bytes ?? null,
        };
      } catch (err) {
        console.error(`[catalogue] Vertex ${viewId} failed — falling back to Gemini:`, err);
      }
    }
    // Gemini (Natural Drape): prompt-based with the reference in context.
    const result = await runGeminiImageGen({
      productId: product.id,
      productTitle: product.title,
      productCategory: product.category,
      productColor: product.color,
      productBuffer: productSource.buffer,
      productMime: productSource.mime,
      referenceBuffer: reference?.buffer ?? null,
      referenceMime: reference?.mime ?? null,
      prompt: promptText,
      folder: "product-match/catalogue",
      view: viewId,
      usage,
      quality,
      // Region references (pallu/border/…) — Gemini path only; Vertex VTO has
      // no equivalent. Empty unless region conditioning is enabled + uploads
      // matched a category's generation references.
      extraReferences,
    });
    return result
      ? {
          url: result.url,
          provider: "gemini",
          model: result.model,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        }
      : null;
  }

  // Sequential: keeps within provider rate limits and orders results by view.
  for (const view of baseViews) {
    const isBack = view.id === "back";
    const reference = isBack ? backRef : frontRef;
    // Use the real back image for the back view when available.
    const productSource = isBack && backSource ? backSource : source;
    const productUrl = isBack && product.backImageUrl ? product.backImageUrl : product.imageUrl;

    // Region conditioning (flag-gated): match this view's generation references
    // to the retailer's uploaded part images, fetch the pixels, and pass them
    // to BOTH the prompt roll-call and the generator — in the same order. Gemini
    // path only. Absent uploads → no conditioning for that region (unchanged).
    const promptRefs: Array<{ label: string; placement: string }> = [];
    const imageRefs: Array<{ buffer: Buffer; mime: string; label: string }> = [];
    if (regionConditioningEnabled && provider === "gemini") {
      for (const ref of genReferencesFor(product.category, view.id as "front" | "back")) {
        const part = partImages.find((p) => p.slot === ref.slot);
        if (!part) continue;
        const buf = await fetchProductImageBuffer(part.url);
        if (!buf) continue;
        imageRefs.push({ buffer: buf.buffer, mime: buf.mime, label: ref.label });
        promptRefs.push({ label: ref.label, placement: ref.placement });
      }
    }

    const prompt = buildViewPrompt({
      category: product.category,
      color: product.color,
      gender: product.gender,
      view,
      hasReference: Boolean(reference),
      // Back view uses back-image notes; all other views use front notes.
      detailNotes: isBack ? product.backDetailNotes : product.detailNotes,
      // Same studio for front + back; the crop-derived close-ups inherit it.
      backdrop,
      // Pin the back to the front's realized backdrop colour (front defines it).
      studioAnchor: isBack ? studioAnchor : null,
      extraReferences: promptRefs,
    });

    const shot = await generateBaseShot(
      view.id as "front" | "back",
      prompt,
      reference,
      productSource,
      productUrl,
      imageRefs
    );
    if (shot) {
      baseShots[view.id as "front" | "back"] = shot;
      // After the front shot lands, capture its backdrop colour so the back
      // shot (next iteration) can be pinned to the exact same studio.
      if (view.id === "front") {
        studioAnchor = await sampleStudioColor(shot.url);
      }
    }
  }

  // Build the display card stack: AI base shots, model-crops, and the retailer's
  // enhanced uploaded detail images (with base-crop fallback). Branding is
  // applied later by the engine, on each final card.
  const baseRefs: Partial<Record<"front" | "back", { url: string; provider: string }>> = {};
  for (const k of ["front", "back"] as const) {
    const b = baseShots[k];
    if (b) baseRefs[k] = { url: b.url, provider: b.provider };
  }

  const stack = resolveCatalogueStack({
    category: product.category,
    baseShots: baseRefs,
    partImages,
    mainImageUrl: product.imageUrl,
  });

  // Merge the generation metadata back onto the AI base cards (for recording).
  const images: GeneratedImage[] = stack.map((card) => {
    if (card.source === "ai-base") {
      const b = baseShots[card.view as "front" | "back"];
      return {
        url: card.url,
        view: card.view,
        provider: card.provider,
        source: card.source,
        modelName: b?.model ?? undefined,
        width: b?.width ?? null,
        height: b?.height ?? null,
        bytes: b?.bytes ?? null,
      };
    }
    return { url: card.url, view: card.view, provider: card.provider, source: card.source };
  });

  return { images };
}

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
import { resolveCloseUps, buildCropUrl } from "../crop-templates";
import type { GeneratedImage } from "../persist";

export interface StrategyProduct {
  id: string;
  title: string;
  category: string;
  color: string;
  gender: string;
  imageUrl: string;
}

export type CatalogueBackend = "gemini" | "vertex";

export async function runCatalogueStrategy(opts: {
  product: StrategyProduct;
  modelType: ModelType;
  /** Resolved backend (auto already resolved to a concrete provider). */
  provider?: CatalogueBackend;
}): Promise<{ images: GeneratedImage[] }> {
  const { product, modelType, provider = "gemini" } = opts;

  const source = await fetchProductImageBuffer(product.imageUrl);
  if (!source) return { images: [] };

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

  const images: GeneratedImage[] = [];
  const baseUrls: Partial<Record<"front" | "back", string>> = {};

  /** Generate one base shot via the chosen provider, with Gemini fallback. */
  async function generateBaseShot(
    viewId: "front" | "back",
    promptText: string,
    reference: ReferenceImage | null
  ): Promise<string | null> {
    // Vertex (Sharp Fit): VTO with the reference model as the person. Needs a
    // reference; back views need the back reference. Falls back to Gemini.
    if (provider === "vertex" && vertexReady && reference) {
      try {
        const res = await generateTryOnVertex({
          productImageUrl: product.imageUrl,
          userPhotoBuffer: reference.buffer,
          userPhotoMimeType: reference.mime as TryOnMimeType,
          productCategory: product.category,
          productColor: product.color,
          productId: product.id,
          productTitle: product.title,
          userId: "model-gen",
        });
        return res.url;
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
      productBuffer: source!.buffer,
      productMime: source!.mime,
      referenceBuffer: reference?.buffer ?? null,
      referenceMime: reference?.mime ?? null,
      prompt: promptText,
      folder: "product-match/catalogue",
      view: viewId,
    });
    return result?.url ?? null;
  }

  // Sequential: keeps within provider rate limits and orders results by view.
  for (const view of baseViews) {
    const isBack = view.id === "back";
    const reference = isBack ? backRef : frontRef;

    const prompt = buildViewPrompt({
      category: product.category,
      color: product.color,
      gender: product.gender,
      view,
      hasReference: Boolean(reference),
    });

    const url = await generateBaseShot(view.id as "front" | "back", prompt, reference);
    if (url) {
      images.push({ url, view: view.id });
      baseUrls[view.id as "front" | "back"] = url;
    }
  }

  // Derive category close-ups by cropping the matching base shot (no blind crop).
  for (const closeUp of resolveCloseUps(product.category)) {
    const base = baseUrls[closeUp.from];
    if (!base) continue; // base shot failed → skip its close-ups
    images.push({ url: buildCropUrl(base, closeUp.region), view: closeUp.id });
  }

  return { images };
}

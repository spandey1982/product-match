/**
 * Quick Listing strategy — one polished model image, fast.
 *
 * Internal backend: Vertex Virtual Try-On (virtual-try-on-001), which produces
 * clean, structured on-model shots. Vertex needs a PERSON image, which the
 * reference-model library supplies: we feed the category-appropriate reference
 * model as the "person" and the product as the garment.
 *
 * Capability-aware fallback: if Vertex is disabled/unconfigured, or no curated
 * reference asset exists yet, or the Vertex call fails, we transparently fall
 * back to a single Gemini front-view generation. Generation never breaks and
 * the retailer never sees a provider error. Pure: the engine persists.
 */
import {
  generateTryOnVertex,
  isVertexTryOnEnabled,
  getVertexConfig,
} from "@/lib/tryon-vertex";
import { fetchProductImageBuffer, runGeminiImageGen } from "@/lib/generate-model-image";
import type { TryOnMimeType } from "@/lib/tryon";
import { resolvePromptSet, buildViewPrompt } from "../prompt-sets";
import { resolveReferenceVariant } from "../reference-selection";
import { loadReferenceImage, type ModelType } from "../reference-models";
import type { GeneratedImage } from "../persist";
import type { StrategyProduct } from "./catalogue";

export async function runQuickListingStrategy(opts: {
  product: StrategyProduct;
  modelType: ModelType;
}): Promise<{ images: GeneratedImage[]; usedFallback: boolean }> {
  const { product, modelType } = opts;

  const variant = resolveReferenceVariant(product.category);
  // Quick Listing is a single front-facing shot → use the front reference.
  const reference = await loadReferenceImage(modelType, variant, { profile: "front" });

  const vertexReady =
    isVertexTryOnEnabled() && getVertexConfig() !== null && reference !== null;

  // ── Primary path: Vertex VTO with the reference model as the person ───────
  if (vertexReady && reference) {
    try {
      const result = await generateTryOnVertex({
        productImageUrl: product.imageUrl,
        userPhotoBuffer: reference.buffer,
        userPhotoMimeType: reference.mime as TryOnMimeType,
        productCategory: product.category,
        productColor: product.color,
        productId: product.id,
        productTitle: product.title,
        userId: "model-gen",
      });
      return { images: [{ url: result.url, view: "front" }], usedFallback: false };
    } catch (err) {
      console.error(
        "[model-gen] quick-listing Vertex failed — falling back to Gemini:",
        err
      );
      // fall through
    }
  }

  // ── Fallback: a single Gemini front-view image (reference used if present) ─
  const source = await fetchProductImageBuffer(product.imageUrl);
  if (!source) return { images: [], usedFallback: true };

  const frontView = resolvePromptSet(product.category)[0];
  const prompt = buildViewPrompt({
    category: product.category,
    color: product.color,
    gender: product.gender,
    view: frontView,
    hasReference: Boolean(reference),
  });

  const result = await runGeminiImageGen({
    productId: product.id,
    productTitle: product.title,
    productCategory: product.category,
    productColor: product.color,
    productBuffer: source.buffer,
    productMime: source.mime,
    referenceBuffer: reference?.buffer ?? null,
    referenceMime: reference?.mime ?? null,
    prompt,
    folder: "product-match/models",
    view: "front",
  });

  return {
    images: result ? [{ url: result.url, view: "front" }] : [],
    usedFallback: true,
  };
}

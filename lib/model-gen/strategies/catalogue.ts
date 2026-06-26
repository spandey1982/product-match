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
}): Promise<{ images: GeneratedImage[] }> {
  const { product, modelType, provider = "gemini", userId } = opts;
  // Same store + acting user for every call in this run; feature is "catalogue".
  const usage = { feature: "catalogue", storeId: userId ?? null, userId: userId ?? null };

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

  const images: GeneratedImage[] = [];
  const baseShots: Partial<Record<"front" | "back", BaseShot>> = {};

  /** Generate one base shot via the chosen provider, with Gemini fallback. */
  async function generateBaseShot(
    viewId: "front" | "back",
    promptText: string,
    reference: ReferenceImage | null,
    productSource: { buffer: Buffer; mime: string },
    productUrl: string
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

    const prompt = buildViewPrompt({
      category: product.category,
      color: product.color,
      gender: product.gender,
      view,
      hasReference: Boolean(reference),
      // Back view uses back-image notes; all other views use front notes.
      detailNotes: isBack ? product.backDetailNotes : product.detailNotes,
    });

    const shot = await generateBaseShot(
      view.id as "front" | "back",
      prompt,
      reference,
      productSource,
      productUrl
    );
    if (shot) {
      images.push({
        url: shot.url,
        view: view.id,
        provider: shot.provider,
        modelName: shot.model ?? undefined,
        width: shot.width,
        height: shot.height,
        bytes: shot.bytes,
      });
      baseShots[view.id as "front" | "back"] = shot;
    }
  }

  // Derive category close-ups by cropping the matching base shot (no blind crop).
  // A close-up inherits the provider of the base shot it was cropped from.
  for (const closeUp of resolveCloseUps(product.category)) {
    const base = baseShots[closeUp.from];
    if (!base) continue; // base shot failed → skip its close-ups
    images.push({
      url: buildCropUrl(base.url, closeUp.region),
      view: closeUp.id,
      provider: base.provider,
    });
  }

  return { images };
}

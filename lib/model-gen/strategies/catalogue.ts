/**
 * Catalogue / Social strategy — multiple catalogue-ready images.
 *
 * Generates two BASE model shots (Front Full, Back Full) via Gemini, each seeded
 * with the matching front/back reference model, then DERIVES category-specific
 * close-ups by cropping configured regions of those base shots (crop-templates).
 * This yields the per-category sets (saree 5, lehenga 4, others 3) with only two
 * generation calls. Pure: returns URLs; the engine persists.
 */
import { fetchProductImageBuffer, runGeminiImageGen } from "@/lib/generate-model-image";
import { resolvePromptSet, buildViewPrompt } from "../prompt-sets";
import { resolveReferenceVariant } from "../reference-selection";
import { loadReferenceImage, type ModelType } from "../reference-models";
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

export async function runCatalogueStrategy(opts: {
  product: StrategyProduct;
  modelType: ModelType;
}): Promise<{ images: GeneratedImage[] }> {
  const { product, modelType } = opts;

  const source = await fetchProductImageBuffer(product.imageUrl);
  if (!source) return { images: [] };

  const variant = resolveReferenceVariant(product.category);
  // Load front + back reference profiles once; each gracefully falls back to the
  // legacy single image, then to the basic model, then to null.
  const frontRef = await loadReferenceImage(modelType, variant, { profile: "front" });
  const backRef = await loadReferenceImage(modelType, variant, { profile: "back" });

  // Base shots: the Front + Back full views from the category's prompt set.
  const baseViews = resolvePromptSet(product.category).filter(
    (v) => v.id === "front" || v.id === "back"
  );

  const images: GeneratedImage[] = [];
  const baseUrls: Partial<Record<"front" | "back", string>> = {};

  // Sequential: keeps within Gemini rate limits and orders results by view.
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
      folder: "product-match/catalogue",
      view: view.id,
    });

    if (result) {
      images.push({ url: result.url, view: view.id });
      baseUrls[view.id as "front" | "back"] = result.url;
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

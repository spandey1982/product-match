/**
 * Catalogue / Social strategy — multiple catalogue-ready images.
 *
 * Internal backend: Gemini (prompt-based), which handles complex Indian drapes
 * and multi-view prompting well. For each view in the category's prompt set we
 * run one Gemini generation, seeded with the category-appropriate reference
 * model when a curated asset exists. Pure: returns the generated URLs and does
 * NOT write to the database — the engine persists.
 */
import { fetchProductImageBuffer, runGeminiImageGen } from "@/lib/generate-model-image";
import { resolvePromptSet, buildViewPrompt } from "../prompt-sets";
import { resolveReferenceVariant } from "../reference-selection";
import { loadReferenceImage, type ModelType } from "../reference-models";
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
  /** Auto-selected reference asset basename (e.g. a man model). Optional. */
  referenceFile?: string;
}): Promise<{ images: GeneratedImage[] }> {
  const { product, modelType, referenceFile } = opts;

  const source = await fetchProductImageBuffer(product.imageUrl);
  if (!source) return { images: [] };

  const variant = resolveReferenceVariant(product.category);
  const reference = await loadReferenceImage(modelType, variant, {
    explicitFileBase: referenceFile,
  }); // null is fine

  const views = resolvePromptSet(product.category);
  const images: GeneratedImage[] = [];

  // Sequential: keeps within Gemini rate limits and orders results by view.
  for (const view of views) {
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

    if (result) images.push({ url: result.url, view: view.id });
  }

  return { images };
}

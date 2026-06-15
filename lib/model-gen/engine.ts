/**
 * Model Generation engine — the single entry point for objective-based image
 * generation.
 *
 * Flow: resolve the retailer's objective + store model (explicit request →
 * stored defaults) ▸ run the matching strategy (which picks provider, reference
 * asset and prompts internally) ▸ persist the results additively.
 *
 * Deliberately NOT a "provider" abstraction (that is reserved for try-on). This
 * engine is intent-keyed so the future prompt/RAG track slots in here without a
 * teardown. See docs/IMAGE_AI_ROADMAP.md §3, §8.
 */
import { db } from "@/lib/db";
import {
  DEFAULT_OBJECTIVE,
  type GenerationObjective,
} from "./objectives";
import { DEFAULT_MODEL_TYPE, type ModelType } from "./reference-models";
import { getAiGenSettings } from "./settings";
import { persistGeneratedImages, type GeneratedImage } from "./persist";
import { runQuickListingStrategy } from "./strategies/quick-listing";
import { runCatalogueStrategy, type StrategyProduct } from "./strategies/catalogue";

/**
 * Master switch for the objective-based generation UI + routing. When OFF
 * (default), the upload flow shows the original toggle and the generate route
 * uses the legacy single-image flow — production behavior is unchanged.
 */
export function isAiGenObjectivesEnabled(): boolean {
  return process.env.ENABLE_AI_GEN_SETTINGS === "true";
}

export interface GenerateModelImagesInput {
  productId: string;
  /** The retailer who owns the product — used to resolve stored defaults. */
  userId: string;
  /** Explicit objective; falls back to the retailer's stored default. */
  objective?: GenerationObjective;
  /** Explicit store model; falls back to the retailer's stored default. */
  modelType?: ModelType;
}

export interface GenerateModelImagesResult {
  objective: GenerationObjective;
  modelType: ModelType;
  images: GeneratedImage[];
}

export async function generateModelImages(
  input: GenerateModelImagesInput
): Promise<GenerateModelImagesResult> {
  const product = await db.product.findUnique({ where: { id: input.productId } });

  const settings = await getAiGenSettings(input.userId);
  const objective = input.objective ?? settings.defaultObjective;
  const modelType = input.modelType ?? settings.defaultModelType;

  if (!product?.imageUrl) {
    return { objective, modelType, images: [] };
  }

  const strategyProduct: StrategyProduct = {
    id: product.id,
    title: product.title,
    category: product.category,
    color: product.color,
    gender: product.gender,
    imageUrl: product.imageUrl,
  };

  const { images } =
    objective === "quick_listing"
      ? await runQuickListingStrategy({ product: strategyProduct, modelType })
      : await runCatalogueStrategy({ product: strategyProduct, modelType });

  if (images.length > 0) {
    await persistGeneratedImages(product.id, images, objective);
  }

  return { objective, modelType, images };
}

export { DEFAULT_OBJECTIVE, DEFAULT_MODEL_TYPE };

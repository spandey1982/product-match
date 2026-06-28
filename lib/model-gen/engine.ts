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
import { resolveModelType } from "./model-selection";
import { getAiGenSettings } from "./settings";
import { resolveAutoProvider } from "@/lib/providers/auto-routing";
import { getBrandingConfig, applyBranding, resolveBrandingAdapt } from "./branding";
import { resolveBackdropPreset, renderBackdropPrompt } from "./backdrops";
import { pickSmartBackdrop } from "./backdrop-match";
import { persistGeneratedImages, type GeneratedImage } from "./persist";
import { recordGenerations } from "./generation-record";
import { maybeReviewGenerations } from "./ai-review";
import { runQuickListingStrategy } from "./strategies/quick-listing";
import { runCatalogueStrategy, type StrategyProduct } from "./strategies/catalogue";
import { ensureDetailNotes, ensureBackDetailNotes } from "@/lib/metadata/detail-notes";
import { parsePartImages } from "@/lib/product/part-slots";

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
  // No explicit model type → auto-select from the product (category + gender),
  // falling back to the store default only when the product gives no signal.
  const modelType =
    input.modelType ??
    resolveModelType(product?.category, product?.gender, settings.defaultModelType);

  if (!product?.imageUrl) {
    return { objective, modelType, images: [] };
  }

  // Back image for the catalogue back view: any uploaded detail card whose slot
  // is a "back" of the product (blouse-back, kurta-back, coat-back, choli-back,
  // trouser-back, …) feeds back-profile generation. Falls back to the legacy
  // Product.backImageUrl, else null (model invents the back, as before).
  const partImages = parsePartImages(product.partImages);
  const backPart = partImages.find(
    (p) => /back/i.test(p.slot) || /back/i.test(p.label)
  );
  const backImageUrl = backPart?.url ?? product.backImageUrl ?? null;

  // Prompt enrichment: concise, category-grounded detail hints, extracted once
  // and cached. Non-fatal — null when unavailable. Threaded per-view into the
  // prompt so the model is told which fine specifics to preserve. Back notes are
  // only extracted when a back image exists (catalogue back view uses them;
  // quick-listing is front-only and never sees them).
  const ctx = { storeId: input.userId, userId: input.userId };
  const detailNotes = await ensureDetailNotes(product.id, product.imageUrl, product.category, ctx);
  const backDetailNotes = backImageUrl
    ? await ensureBackDetailNotes(product.id, backImageUrl, product.category, ctx)
    : null;

  const strategyProduct: StrategyProduct = {
    id: product.id,
    title: product.title,
    category: product.category,
    color: product.color,
    gender: product.gender,
    imageUrl: product.imageUrl,
    backImageUrl,
    detailNotes,
    backDetailNotes,
  };

  // Catalogue backend: explicit setting, or category-routed when "auto"
  // (drape→Natural Drape/Gemini, structured→Sharp Fit/Vertex). The strategy
  // applies per-view capability fallback to Gemini if Vertex is unavailable.
  const catalogueProvider =
    settings.catalogueProvider === "auto"
      ? resolveAutoProvider({ category: product.category })
      : settings.catalogueProvider;

  // Resolve the backdrop preset: Smart match scores presets against the product
  // (Phase 3, deterministic — no AI call); an explicit choice resolves directly.
  const backdropPreset =
    settings.backdrop.mode === "smart"
      ? pickSmartBackdrop({
          color: product.color,
          category: product.category,
          pattern: product.pattern,
        })
      : resolveBackdropPreset(settings.backdrop);

  // One deterministic studio prompt, reused for every view so the generated set
  // looks like a single studio (Phase 2). Applies to the prompt-based (Gemini /
  // Natural Drape) path; the Vertex (Sharp Fit) VTO path inherits the reference
  // model's studio instead.
  const backdrop = renderBackdropPrompt(backdropPreset);

  const { images } =
    objective === "quick_listing"
      ? await runQuickListingStrategy({
          product: strategyProduct,
          modelType,
          userId: input.userId,
          backdrop,
        })
      : await runCatalogueStrategy({
          product: strategyProduct,
          modelType,
          provider: catalogueProvider,
          userId: input.userId,
          backdrop,
          partImages,
        });

  // Brand each image (store logo, or store name) before persisting, so the
  // branded URL flows to display, share and download. No-op when disabled.
  // Phase 4: branding adapts to the ACTUAL background it sits on — each image's
  // watermark corner is sampled (resolveBrandingAdapt) so the mark is legible
  // and intentional regardless of provider (Gemini studio or Vertex reference
  // background). The preset hint is only a fallback if sampling fails.
  const branding = await getBrandingConfig(input.userId);
  const fallbackAdapt = {
    mark: backdropPreset.branding.preferredLogo,
    brightness: backdropPreset.color.brightness,
  };
  const willBrand =
    branding.enabled && (Boolean(branding.logoPublicId) || Boolean(branding.storeName?.trim()));

  const branded: GeneratedImage[] = await Promise.all(
    images.map(async (img) => {
      if (!willBrand) return img;
      const adapt = await resolveBrandingAdapt(img.url, branding.position, fallbackAdapt);
      return { ...img, url: applyBranding(img.url, branding, adapt) };
    })
  );

  if (branded.length > 0) {
    await persistGeneratedImages(product.id, branded, objective);
    // Record perf/quality rows (non-fatal) for analytics + scoring — only for the
    // ACTUAL generations, not enhanced uploads (which aren't AI-generated).
    const generated = branded.filter((img) => img.source !== "upload");
    const records = await recordGenerations({
      productId: product.id,
      userId: input.userId,
      category: product.category,
      objective,
      defaultProvider: objective === "quick_listing" ? "vertex" : catalogueProvider,
      images: generated,
    });
    // Fire-and-forget AI review (flag- + sample-gated); never blocks the response.
    maybeReviewGenerations(records, { productImageUrl: product.imageUrl });
  }

  return { objective, modelType, images: branded };
}

export { DEFAULT_OBJECTIVE, DEFAULT_MODEL_TYPE };

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
import { checkCloudinaryReachable } from "@/lib/cloudinary";
import {
  DEFAULT_OBJECTIVE,
  type GenerationObjective,
} from "./objectives";
import { DEFAULT_MODEL_TYPE, type ModelType } from "./reference-models";
import { resolveModelType } from "./model-selection";
import { getAiGenSettings } from "./settings";
// resolveAutoProvider was used when catalogueProvider had an "auto" tier
// (retired). Kept out of imports now — the setting is explicit.
import { getBrandingConfig, applyBranding, resolveBrandingPlacement } from "./branding";
import { resolveBackdropPreset, renderBackdropPrompt } from "./backdrops";
import { pickSmartBackdrop } from "./backdrop-match";
import { getScene, SCENES } from "./scenes/library";
import { selectSceneVariation } from "./scenes/rule-engine";
import { resolvePaletteAccent } from "./scenes/color-harmony";
import { renderScenePrompt } from "./scenes/prompt-builder";
import type { BackdropSection } from "./scenes/selection";
import { persistGeneratedImages, type GeneratedImage } from "./persist";
import { recordGenerations } from "./generation-record";
import { maybeReviewGenerations } from "./ai-review";
import { runQuickListingStrategy } from "./strategies/quick-listing";
import { runCatalogueStrategy, type StrategyProduct } from "./strategies/catalogue";
import type { GenerationQuality } from "./quality";
import { ensureDetailNotes, ensureBackDetailNotes } from "@/lib/metadata/detail-notes";
import { ensureGarmentIntelligence, isGarmentIntelligenceEnabled } from "@/lib/garment-intelligence/service";
import { parsePartImages, findBackPart } from "@/lib/product/part-slots";
import { isAiCastingEnabled, getModelProfile, listModelProfiles } from "./casting";
import { resolveCasting, type CastingResult, type CastingProfileInput } from "./casting-match";
import { parseArray } from "@/lib/serialize";
import { chargeForCall } from "@/lib/billing/charge";
import type { BillingOperation } from "@/lib/billing/types";

/**
 * Master switch for the objective-based generation UI + routing. When OFF
 * (default), the upload flow shows the original toggle and the generate route
 * uses the legacy single-image flow — production behavior is unchanged.
 */
export function isAiGenObjectivesEnabled(): boolean {
  return process.env.ENABLE_AI_GEN_SETTINGS === "true";
}

/**
 * Master switch for Scenic (contextual scenes beyond plain Studio backdrops).
 * When OFF (default), the engine always resolves the Studio path regardless
 * of a per-request `backdropSection` — so nothing changes for existing
 * retailers until this is explicitly enabled.
 */
export function isScenicCollectionEnabled(): boolean {
  return process.env.ENABLE_SCENIC_COLLECTION === "true";
}

export interface GenerateModelImagesInput {
  productId: string;
  /** The retailer who owns the product — used to resolve stored defaults. */
  userId: string;
  /** Explicit objective; falls back to the retailer's stored default. */
  objective?: GenerationObjective;
  /** Explicit store model; falls back to the retailer's stored default. */
  modelType?: ModelType;
  /**
   * Native Gemini output quality for this run. Defaults to "standard" — never
   * persisted, the retailer chooses it fresh per generation (lib/model-gen/quality.ts).
   */
  quality?: GenerationQuality;
  /**
   * Studio (default) or Scenic for THIS run. Like `quality`, this is a
   * per-generation choice, never a sticky default — Studio is always what
   * runs unless a retailer explicitly opts into Scenic for that generation.
   * The scene/presence/detail CHOICE underneath Scenic (settings.scenic) is
   * still remembered between generations; only whether Scenic runs at all
   * is not.
   */
  backdropSection?: BackdropSection;
  /**
   * AI Casting — retailer's Signature Model for this generation. When set,
   * the resolver pins the face + brief from this profile; unset falls back
   * to AI Casting's auto-pick. Ignored entirely when ENABLE_AI_CASTING is
   * off (legacy behaviour). Never throws on stale/unknown ids — the flow
   * transparently degrades to auto-pick.
   */
  signatureProfileId?: string;
  /**
   * When false, skip AI Casting entirely and use the legacy reference-model
   * path (retailer picked "Classic" in the UI). Default true — Casting runs
   * if the feature flag is on.
   */
  useCasting?: boolean;
}

export interface GenerateModelImagesResult {
  objective: GenerationObjective;
  modelType: ModelType;
  images: GeneratedImage[];
  /**
   * Why no images were generated, when that's the case.
   * - "storage_unreachable": pre-flight found image storage down — NOTHING
   *   was attempted or spent; retrying later is free and safe.
   * - "generation_failed": generation ran but produced no stored images.
   */
  failure?: "storage_unreachable" | "generation_failed" | "insufficient_credits";
}

export async function generateModelImages(
  input: GenerateModelImagesInput
): Promise<GenerateModelImagesResult> {
  const giEnabled = isGarmentIntelligenceEnabled();
  const [product, giRow] = await Promise.all([
    db.product.findUnique({ where: { id: input.productId } }),
    giEnabled
      ? db.garmentIntelligence.findUnique({ where: { productId: input.productId }, select: { id: true } })
      : null,
  ]);

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

  // Pre-flight: generated images are only worth paying for if they can be
  // STORED. When image storage is unreachable (2026-07-14: DNS/latency
  // degradation to api.cloudinary.com timed out every upload after Gemini
  // had already billed the generations), abort BEFORE any paid call — the
  // caller surfaces "try again later" and nothing is spent. GI analysis is
  // also skipped: its result is DB-cached, so deferring it costs nothing.
  if (!(await checkCloudinaryReachable())) {
    console.error("[model-gen] image storage unreachable — aborting before any paid call");
    return { objective, modelType, images: [], failure: "storage_unreachable" };
  }

  // Back image for the catalogue back view: any uploaded detail card whose slot
  // is a "back" of the product (blouse-back, kurta-back, coat-back, choli-back,
  // trouser-back, …) feeds back-profile generation. Falls back to the legacy
  // Product.backImageUrl, else null (model invents the back, guarded by the
  // deterministic back clause in buildViewPrompt).
  const partImages = parsePartImages(product.partImages);
  const backImageUrl = findBackPart(partImages)?.url ?? product.backImageUrl ?? null;

  // ── Billing: charge for enrichment steps before they run ──────────────
  const hasGI = !!giRow;
  if (giEnabled) {
    if (!hasGI) {
      const giCallCount = 2 + (backImageUrl ? 1 : 0);
      const giCharge = await chargeForCall(input.userId, "garment_intelligence", giCallCount);
      if ("insufficientCredits" in giCharge) {
        return { objective, modelType, images: [], failure: "insufficient_credits" };
      }
    }
  } else {
    if (!product.detailNotes) {
      const charge = await chargeForCall(input.userId, "metadata_extract");
      if ("insufficientCredits" in charge) {
        return { objective, modelType, images: [], failure: "insufficient_credits" };
      }
    }
    if (backImageUrl && !product.backDetailNotes) {
      const charge = await chargeForCall(input.userId, "metadata_extract");
      if ("insufficientCredits" in charge) {
        return { objective, modelType, images: [], failure: "insufficient_credits" };
      }
    }
  }

  // Prompt enrichment, extracted once and cached, non-fatal.
  const ctx = { storeId: input.userId, userId: input.userId };
  let detailNotes: string | null;
  let backDetailNotes: string | null;
  if (giEnabled) {
    const garmentIntel = await ensureGarmentIntelligence(product.id, ctx);
    detailNotes = garmentIntel?.promptNotes || null;
    backDetailNotes = garmentIntel?.backPromptNotes ?? null;
  } else {
    detailNotes = await ensureDetailNotes(product.id, product.imageUrl, product.category, ctx);
    backDetailNotes = backImageUrl
      ? await ensureBackDetailNotes(product.id, backImageUrl, product.category, ctx)
      : null;
  }

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

  // Catalogue backend — retailer's explicit Premium/Economy choice; this
  // is resolved BEFORE casting so the Vertex guard below can short-circuit
  // casting resolution entirely (Vertex VTO can't consume a face+prompt
  // brief; running the resolver would waste work and risk leaking metadata
  // into the request if a downstream caller ever forwarded it).
  const catalogueProvider = settings.catalogueProvider;

  // AI Casting — resolve the signature-model brief (or auto-pick) BEFORE
  // strategy dispatch so the strategy layer can add the face reference and
  // append prompt tokens. When the flag is off, `casting` stays null and
  // strategies fall through to the legacy fused-reference path unchanged.
  // A kids product resolves to face=null (Casting does not apply) and is
  // likewise treated as legacy. VERTEX GUARD: skip resolution outright when
  // the effective provider is Vertex — its VTO input surface can't consume
  // the resulting face/persona brief anyway, and honoring a stale client
  // request would let casting metadata slip through the API boundary.
  let casting: CastingResult | null = null;
  if (isAiCastingEnabled() && catalogueProvider === "gemini" && input.useCasting !== false) {
    const profileRow = input.signatureProfileId
      ? await getModelProfile(input.signatureProfileId, input.userId)
      : null;
    // When no explicit Signature Model was chosen, load the retailer's active
    // ones so the resolver can auto-select a fitting one (category/style/
    // persona match). Skipped when the retailer picked a specific model —
    // that request is authoritative and needs no scoring.
    const retailerProfiles: CastingProfileInput[] = profileRow
      ? []
      : (await listModelProfiles(input.userId)).map((p) => ({
          id: p.id,
          faceId: p.faceId,
          metadata: p.metadata,
          poseMode: p.poseMode,
        }));
    const resolved = resolveCasting({
      product: {
        id: product.id,
        category: product.category,
        gender: product.gender,
        color: product.color,
        colors: parseArray(product.colors),
        occasion: parseArray(product.occasion),
        styleTags: parseArray(product.styleTags),
        pattern: product.pattern,
      },
      fallbackModelType: settings.defaultModelType,
      profile: profileRow
        ? {
            id: profileRow.id,
            faceId: profileRow.faceId,
            metadata: profileRow.metadata,
            poseMode: profileRow.poseMode,
          }
        : null,
      retailerProfiles,
    });
    // Kids bypass (or any resolve that returned face=null) → legacy path.
    if (resolved.face) casting = resolved;
  }

  // Resolve the backdrop/scene fragment. Two peer sections, same output shape
  // (a single deterministic prompt string + a branding fallback hint) so
  // everything downstream — buildViewPrompt, branding placement, recording —
  // is identical either way. Studio: Smart match scores presets against the
  // product (deterministic — no AI call); an explicit choice resolves
  // directly. Scenic Collection: the rule engine picks a curated variation +
  // colour-harmony accent, the Prompt Builder composes the fragment. Both
  // paths are pure/deterministic — zero extra AI calls in either case.
  // VERTEX GUARD: Vertex ignores our backdrop/scene fragment (VTO inherits
  // the reference model's studio). Force Studio here so recorded metadata
  // matches what actually happened — a stale client can't get us to log a
  // scenic run against a Vertex generation.
  const useScenic =
    catalogueProvider === "gemini" &&
    (input.backdropSection ?? "studio") === "scenic" &&
    isScenicCollectionEnabled();

  // Quality: per-request override wins; otherwise use the retailer's
  // remembered setting. Vertex ignores the field internally (single output
  // size) so this only affects the Gemini path.
  const effectiveQuality = input.quality ?? settings.quality;

  let backdrop: string;
  let brandingHint: { preferredLogo: "dark" | "light"; brightness: number };
  let sceneMeta: { sceneId: string; intensity: string; density: string } | null = null;

  if (useScenic) {
    const scene = getScene(settings.scenic.sceneId) ?? SCENES[0];
    const variation = selectSceneVariation(scene, {
      color: product.color,
      category: product.category,
      pattern: product.pattern,
    });
    const accent = resolvePaletteAccent(scene, product.color);
    backdrop = renderScenePrompt(scene, variation, settings.scenic.intensity, settings.scenic.density, accent);
    brandingHint = scene.brandingHint;
    sceneMeta = {
      sceneId: scene.id,
      intensity: settings.scenic.intensity,
      density: settings.scenic.density,
    };
  } else {
    const backdropPreset =
      settings.backdrop.mode === "smart"
        ? pickSmartBackdrop({
            color: product.color,
            category: product.category,
            pattern: product.pattern,
          })
        : resolveBackdropPreset(settings.backdrop);
    // One deterministic studio prompt, reused for every view so the generated
    // set looks like a single studio. Applies to the prompt-based (Gemini /
    // Natural Drape) path; the Vertex (Sharp Fit) VTO path inherits the
    // reference model's studio instead.
    backdrop = renderBackdropPrompt(backdropPreset);
    brandingHint = { preferredLogo: backdropPreset.branding.preferredLogo, brightness: backdropPreset.color.brightness };
  }

  // ── Billing: charge for image generation ──────────────────────────────
  const isCatalogue = objective !== "quick_listing";
  const imageCount = isCatalogue ? 2 : 1;
  const imgOp: BillingOperation =
    catalogueProvider === "vertex"
      ? "vai_image_gen"
      : effectiveQuality === "enhanced" ? "image_gen_2k" : "image_gen_1k";
  const imgCharge = await chargeForCall(input.userId, imgOp, imageCount);
  if ("insufficientCredits" in imgCharge) {
    return { objective, modelType, images: [], failure: "insufficient_credits" };
  }

  // Bidirectional consistency: check for existing ProductImages from a
  // previous partial run. If one view succeeded but the other failed, the
  // existing view's image is passed to the strategy as a cross-view
  // reference so the AI maintains model identity on retry.
  let existingFrontUrl: string | null = null;
  let existingBackUrl: string | null = null;
  if (isCatalogue) {
    const existingImages = await db.productImage.findMany({
      where: { productId: product.id, view: { in: ["front", "back"] }, objective: "catalogue" },
      orderBy: { createdAt: "desc" },
      select: { view: true, url: true },
      take: 2,
    });
    for (const img of existingImages) {
      if (img.view === "front" && !existingFrontUrl) existingFrontUrl = img.url;
      if (img.view === "back" && !existingBackUrl) existingBackUrl = img.url;
    }
  }

  const { images } =
    objective === "quick_listing"
      ? await runQuickListingStrategy({
          product: strategyProduct,
          modelType,
          userId: input.userId,
          backdrop,
          quality: effectiveQuality,
          // Route Quick Listing by the retailer's Premium/Economy pick just
          // like Catalogue. "vertex" preserves the historic Gemini fallback
          // safety net; "gemini" skips Vertex entirely.
          provider: catalogueProvider,
          casting,
        })
      : await runCatalogueStrategy({
          product: strategyProduct,
          modelType,
          provider: catalogueProvider,
          userId: input.userId,
          backdrop,
          // VERTEX GUARD: partImages fuel the multi-image Catalogue prompt
          // on the Gemini path; Vertex VTO can't consume extras. Drop them
          // before dispatch so a stale client can't send close-ups that end
          // up quietly ignored (and never billed for) — clearer intent.
          partImages: catalogueProvider === "gemini" ? partImages : [],
          quality: effectiveQuality,
          casting,
          existingFrontUrl,
          existingBackUrl,
        });

  // Brand each image (store logo, or store name) before persisting, so the
  // branded URL flows to display, share and download. No-op when disabled.
  // Phase 4 + R3: branding adapts to the ACTUAL image — each card's four corners
  // are sampled (resolveBrandingPlacement) so the mark lands in the calmest
  // corner (least product overlap) in a colour legible against it, regardless of
  // provider. The preset hint is only a fallback if sampling fails.
  const branding = await getBrandingConfig(input.userId);
  const fallbackAdapt = {
    mark: brandingHint.preferredLogo,
    brightness: brandingHint.brightness,
  };
  const willBrand =
    branding.enabled && (Boolean(branding.logoPublicId) || Boolean(branding.storeName?.trim()));

  const branded: GeneratedImage[] = await Promise.all(
    images.map(async (img) => {
      if (!willBrand) return img;
      const placement = await resolveBrandingPlacement(img.url, branding.position, fallbackAdapt);
      return { ...img, url: applyBranding(img.url, branding, placement) };
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
      sceneMeta,
    });
    // Fire-and-forget AI review (flag- + sample-gated); never blocks the response.
    maybeReviewGenerations(records, { productImageUrl: product.imageUrl });
  }

  // No AI-generated image survived (upload-sourced cards don't count) —
  // e.g. every upload failed after generation. Callers tell the retailer to
  // retry instead of silently showing nothing.
  const generatedCount = branded.filter((img) => img.source !== "upload").length;
  return {
    objective,
    modelType,
    images: branded,
    ...(generatedCount === 0 ? { failure: "generation_failed" as const } : {}),
  };
}

export { DEFAULT_OBJECTIVE, DEFAULT_MODEL_TYPE };

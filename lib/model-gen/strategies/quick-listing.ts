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
import type { GenerationQuality } from "../quality";
import { loadFaceImage } from "../faces";
import { renderCastingSuffix, IDENTITY_FACE_LABEL } from "../casting-prompt";
import type { CastingResult } from "../casting-match";

export async function runQuickListingStrategy(opts: {
  product: StrategyProduct;
  modelType: ModelType;
  /** Retailer who owns the product — for AI cost attribution. */
  userId?: string;
  /** Studio backdrop fragment — applied on the Gemini fallback path. */
  backdrop: string;
  /** Native Gemini output quality for the fallback path. Defaults to "standard". */
  quality?: GenerationQuality;
  /**
   * AI Casting result (null = legacy path). Non-null adds the face identity
   * reference and appends appearance/persona tokens on the Gemini fallback
   * path only; the Vertex VTO primary path always uses the legacy fused
   * reference (VTO needs a full person image).
   */
  casting?: CastingResult | null;
}): Promise<{ images: GeneratedImage[]; usedFallback: boolean }> {
  const { product, modelType, userId, backdrop, quality, casting = null } = opts;
  const usage = { feature: "quick_listing", storeId: userId ?? null, userId: userId ?? null };

  const variant = resolveReferenceVariant(product.category);
  // Quick Listing is a single front-facing shot → use the front reference.
  const reference = await loadReferenceImage(modelType, variant, { profile: "front" });

  // AI Casting — face identity reference for the Gemini fallback (Vertex VTO
  // ignores extraReferences). Missing asset → null → legacy behaviour intact.
  const faceRef = casting?.face ? await loadFaceImage(casting.face.id) : null;
  const castingSuffix = casting ? renderCastingSuffix(casting.metadata, casting.poseMode) : "";
  const editorial = casting?.poseMode === "editorial";

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
        usage,
      });
      return {
        images: [{
          url: result.url, view: "front", provider: "vertex", source: "ai-base",
          modelName: result.model ?? undefined,
          width: result.width ?? null, height: result.height ?? null, bytes: result.bytes ?? null,
        }],
        usedFallback: false,
      };
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
  // Editorial drops the drape reference on the Gemini path so pose can vary.
  const geminiDrapeRef = editorial ? null : reference;

  const promptRefs: Array<{ label: string; placement: string }> = [];
  const imageRefs: Array<{ buffer: Buffer; mime: string; label: string }> = [];
  if (faceRef) {
    imageRefs.push({ buffer: faceRef.buffer, mime: faceRef.mime, label: IDENTITY_FACE_LABEL });
    promptRefs.push({ label: IDENTITY_FACE_LABEL, placement: "" });
  }

  const basePrompt = buildViewPrompt({
    category: product.category,
    color: product.color,
    gender: product.gender,
    view: frontView,
    hasReference: Boolean(geminiDrapeRef),
    detailNotes: product.detailNotes,
    backdrop,
    extraReferences: promptRefs,
    hasIdentityReference: Boolean(faceRef),
  });
  const prompt = castingSuffix ? `${basePrompt} ${castingSuffix}` : basePrompt;

  const result = await runGeminiImageGen({
    productId: product.id,
    productTitle: product.title,
    productCategory: product.category,
    productColor: product.color,
    productBuffer: source.buffer,
    productMime: source.mime,
    referenceBuffer: geminiDrapeRef?.buffer ?? null,
    referenceMime: geminiDrapeRef?.mime ?? null,
    prompt,
    folder: "product-match/models",
    view: "front",
    usage,
    quality,
    extraReferences: imageRefs,
  });

  return {
    images: result
      ? [{
          url: result.url, view: "front", provider: "gemini", source: "ai-base",
          modelName: result.model,
          width: result.width, height: result.height, bytes: result.bytes,
        }]
      : [],
    usedFallback: true,
  };
}

/**
 * Erase / fix-region — a targeted edit of an already-generated ProductImage
 * (docs/research/SESSION_HANDOFF_2026-08-08.md priority #2).
 *
 * Gemini's generateContent API has no structured mask parameter — a mask is
 * just another image input plus a text instruction, interpreted in-context
 * by an autoregressive image model, not a hard API guarantee the way Vertex
 * Imagen's dedicated inpainting endpoint would be. So this does NOT trust
 * the model to respect the mask boundary: it generates a full-image edit
 * candidate, then composites that candidate against the ORIGINAL image using
 * the retailer's mask (feathered at the edge) via sharp. That composite step
 * is what actually guarantees everything outside the masked region comes
 * back pixel-identical, regardless of how well the model behaved.
 */
import sharp, { type Sharp } from "sharp";
import { fetchProductImageBuffer } from "@/lib/generate-model-image";
import { uploadWithRetry } from "@/lib/cloudinary";
import { getImageDimensions, fmtBytes } from "@/lib/image-utils";
import { recordAiUsage, type AiUsageContext } from "@/lib/ai-usage/record";
import { getBrandingConfig, applyBranding, resolveBrandingPlacement } from "./branding";
import { preprocessProductImage } from "@/lib/images/preprocess";
import { reencodeGeneratedImage } from "@/lib/images/reencode";
import { DEFAULT_IMAGE_GEN_MODEL, type ImageGenModel } from "./image-gen-models";
import { getQualityProfile } from "./quality";
import { buildErasePrompt } from "./erase-prompt";

/**
 * Remove ONLY the branding overlay segment(s) from a delivery URL — matched
 * by content (the exact `l_` layer prefixes branding.ts's buildOverlayTransform
 * always uses), not position. Deliberately does NOT strip a crop transform:
 * a cropped card (pallu/pleats/blouse — crop-templates.ts) is what the
 * retailer actually painted a mask against, so the edit's "original" must
 * keep the same crop/framing/pixel-dimensions the mask's coordinates were
 * drawn in — only the corner watermark needs to come off before editing (and
 * gets reapplied fresh afterward, same as a normal generation).
 */
export function stripCloudinaryTransforms(url: string): string {
  return url
    .split("/")
    .filter(
      (seg) => !seg.startsWith("l_product-match:brand:") && !seg.startsWith("l_text:Arial_50_bold_letter_spacing_3")
    )
    .join("/");
}

/**
 * Grow (dilate) a mask outward by roughly `px` — blur spreads white into
 * neighboring black pixels, then a low re-threshold turns "received any
 * white at all" back into solid white. Standard raster-mask dilation trick;
 * sharp has no dedicated dilate operator.
 *
 * Why this exists (2026-08-11 retailer test): a retailer's hand-painted mask
 * covers the OBJECT they want gone, rarely its full cast shadow/reflection —
 * those extend past the object's own silhouette. Since the composite step
 * protects everything outside the mask by design, a shadow just outside the
 * painted line survives untouched and reads as a leftover "hint" of the
 * removed content. A modest, automatic margin catches that without asking
 * retailers to trace shadows precisely by hand.
 */
async function dilateMask(mask: Sharp, px: number): Promise<Buffer> {
  // sharp/libvips applies `.threshold()` at a fixed internal pipeline stage
  // BEFORE `.blur()` regardless of JS chain order — chaining both on one
  // pipeline silently no-ops the dilation (verified empirically: edge moved
  // 642→641px instead of the expected ~20px growth). Materializing the
  // blurred buffer first and running threshold as a genuinely separate
  // pipeline forces real sequential execution (642→662px, as expected).
  const blurred = await mask.blur(px).png().toBuffer();
  return sharp(blurred).threshold(20).png().toBuffer();
}

/**
 * Feather width scales with image size — a fixed small pixel value is
 * imperceptible on a thumbnail but reads as a visible hard seam on a
 * ~1800-2400px catalogue photo (2026-08-11 finding). ~1% of the shorter
 * side gives a smooth blend at any resolution this feature runs at.
 */
function featherPxFor(width: number, height: number): number {
  return Math.max(10, Math.round(Math.min(width, height) * 0.01));
}

/** Dilation margin — same scaling logic, deliberately larger than the feather. */
function dilatePxFor(width: number, height: number): number {
  return Math.max(14, Math.round(Math.min(width, height) * 0.018));
}

export interface EraseRegionInput {
  productId: string;
  userId: string;
  /** The image being corrected — its CURRENT stored (possibly branded/cropped) url. */
  baseImageUrl: string;
  /** Retailer-drawn mask — white = region to edit, black = keep. Any size; resized to match internally. */
  maskBuffer: Buffer;
  correctionText: string;
  /** Optional reference photo (an existing part-slot upload) guiding what goes inside the masked region. */
  reference?: { buffer: Buffer; mime: string; label: string } | null;
  usage: AiUsageContext;
  model?: ImageGenModel;
}

export interface EraseRegionResult {
  url: string;
  width: number | null;
  height: number | null;
  bytes: number;
  model: string;
}

export async function runGeminiRegionEdit(input: EraseRegionInput): Promise<EraseRegionResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") return null;

  const modelId: ImageGenModel = input.model ?? DEFAULT_IMAGE_GEN_MODEL;
  const qualityProfile = getQualityProfile("standard");
  const feature = input.usage.feature;
  const storeId = input.usage.storeId ?? null;
  const usageUserId = input.usage.userId ?? null;

  const rawBaseUrl = stripCloudinaryTransforms(input.baseImageUrl);
  const original = await fetchProductImageBuffer(rawBaseUrl);
  if (!original) return null;

  try {
    const originalMeta = await sharp(original.buffer).rotate().metadata();
    const origWidth = originalMeta.width ?? 0;
    const origHeight = originalMeta.height ?? 0;
    if (origWidth <= 0 || origHeight <= 0) return null;

    // Dilate once at native resolution — both the model-facing mask and the
    // final composite alpha derive from this, so the model gets to see (and
    // fill) the same grown region the composite will actually keep.
    const dilatePx = dilatePxFor(origWidth, origHeight);
    const dilatedMaskNative = await dilateMask(
      sharp(input.maskBuffer).resize({ width: origWidth, height: origHeight, fit: "fill" }).flatten({ background: "black" }),
      dilatePx
    );

    // Base image + mask, downscaled together to what the model actually sees —
    // same preprocessing every other generation call uses (lib/images/preprocess.ts).
    const { buffer: modelBaseBuffer, mime: modelBaseMime } = await preprocessProductImage(
      original.buffer,
      original.mime
    );
    const modelBaseMeta = await sharp(modelBaseBuffer).metadata();
    const maskForModel = await sharp(dilatedMaskNative)
      .resize({ width: modelBaseMeta.width, height: modelBaseMeta.height, fit: "fill" })
      .png()
      .toBuffer();

    const processedReference = input.reference
      ? await preprocessProductImage(input.reference.buffer, input.reference.mime)
      : null;

    const prompt = buildErasePrompt({
      correctionText: input.correctionText,
      referenceLabel: input.reference?.label ?? null,
    });

    const parts: Array<Record<string, unknown>> = [
      { inline_data: { mime_type: modelBaseMime, data: modelBaseBuffer.toString("base64") } },
      { inline_data: { mime_type: "image/png", data: maskForModel.toString("base64") } },
    ];
    if (processedReference) {
      parts.push({
        inline_data: { mime_type: processedReference.mime, data: processedReference.buffer.toString("base64") },
      });
    }
    parts.push({ text: prompt });

    const imageInputs = 2 + (processedReference ? 1 : 0);
    const requestBytes =
      modelBaseBuffer.length + maskForModel.length + (processedReference ? processedReference.buffer.length : 0);

    console.log(`[erase] ── Gemini region edit ────────────────────────`);
    console.log(`[erase] Product: ${input.productId}  reference=${Boolean(processedReference)}`);

    const t0 = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { imageSize: qualityProfile.imageSize, aspectRatio: qualityProfile.aspectRatio },
          },
        }),
      }
    );
    const generationMs = Date.now() - t0;
    console.log(`[erase] Gemini responded: ${res.status}  (${generationMs} ms)`);

    if (!res.ok) {
      const err = await res.text();
      console.error(`[erase] Gemini error ${res.status}:`, err.slice(0, 200));
      void recordAiUsage({
        provider: "gemini",
        model: modelId,
        feature,
        operation: "erase_region",
        durationMs: generationMs,
        requestBytes,
        imageInputs,
        storeId,
        userId: usageUserId,
        productId: input.productId,
        status: "error",
        errorMessage: `HTTP ${res.status}: ${err.slice(0, 300)}`,
      });
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> };
        finishReason?: string;
      }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    const usageMeta = data.usageMetadata;
    const tokenInput = usageMeta?.promptTokenCount ?? null;
    const tokenOutput = usageMeta?.candidatesTokenCount ?? null;
    const tokenTotal = usageMeta?.totalTokenCount ?? null;

    const responseParts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = responseParts.find((p) => p.inlineData?.data);
    if (!imagePart) {
      const finishReason = data.candidates?.[0]?.finishReason;
      console.error(`[erase] No image in Gemini response (finish: ${finishReason})`);
      void recordAiUsage({
        provider: "gemini",
        model: modelId,
        feature,
        operation: "erase_region",
        inputTokens: tokenInput,
        outputTokens: tokenOutput,
        totalTokens: tokenTotal,
        durationMs: generationMs,
        requestBytes,
        imageInputs,
        storeId,
        userId: usageUserId,
        productId: input.productId,
        status: "error",
        errorMessage: `No image returned. Finish reason: ${finishReason ?? "unknown"}`,
      });
      return null;
    }

    const editedRaw = Buffer.from(imagePart.inlineData!.data, "base64");

    // ── Composite: this is what actually enforces "only the masked region
    // changed" — resize Gemini's full-image candidate to the ORIGINAL's
    // native dimensions, then paste it through a feathered version of the
    // (already dilated) mask onto the untouched original. ─────────────────
    const editedResized = await sharp(editedRaw)
      .resize({ width: origWidth, height: origHeight, fit: "fill" })
      .toBuffer();

    // dilatedMaskNative is already flattened/binarized at origWidth×origHeight
    // (see dilateMask above) — just soften its edge for the final blend.
    const featherPx = featherPxFor(origWidth, origHeight);
    const maskAlpha = await sharp(dilatedMaskNative).greyscale().blur(featherPx).raw().toBuffer();

    const editedWithAlpha = await sharp(editedResized)
      .ensureAlpha()
      .joinChannel(maskAlpha, { raw: { width: origWidth, height: origHeight, channels: 1 } })
      .png()
      .toBuffer();

    const compositedBuffer = await sharp(original.buffer)
      .rotate()
      .resize(origWidth, origHeight, { fit: "fill" })
      .composite([{ input: editedWithAlpha, blend: "over" }])
      .png()
      .toBuffer();

    const { buffer: storedBuffer, mime: storedMime } = await reencodeGeneratedImage(compositedBuffer, "image/png");
    const outDims = getImageDimensions(storedBuffer, storedMime);
    console.log(`[erase] Composited output: ${fmtBytes(storedBuffer.length)}  ${outDims ? `${outDims.width}×${outDims.height}px` : ""}`);

    const dataUri = `data:${storedMime};base64,${storedBuffer.toString("base64")}`;
    let uploaded: { secure_url: string } | null = null;
    let uploadError: unknown = null;
    try {
      uploaded = await uploadWithRetry(dataUri, {
        folder: "product-match/catalogue",
        timeout: 120_000,
        tags: [`product:${input.productId}`, "erase-edit"],
        context: { product_id: input.productId, edited_at: new Date().toISOString() },
      });
    } catch (err) {
      uploadError = err;
      console.error("[erase] Cloudinary upload failed after retries (Gemini generation itself SUCCEEDED):", err);
    }
    if (!uploaded) {
      const e = uploadError as { error?: { message?: string; http_code?: number }; message?: string } | null;
      const detail = e?.error?.message ?? e?.message ?? String(uploadError);
      void recordAiUsage({
        provider: "gemini",
        model: modelId,
        feature,
        operation: "erase_region",
        inputTokens: tokenInput,
        outputTokens: tokenOutput,
        totalTokens: tokenTotal,
        imagesGenerated: 1,
        imageInputs,
        requestBytes,
        responseBytes: editedRaw.length,
        durationMs: generationMs,
        storeId,
        userId: usageUserId,
        productId: input.productId,
        status: "error",
        errorMessage: `cloudinary_upload: ${String(detail).slice(0, 250)}`,
      });
      return null;
    }

    // Re-apply branding the same way the original generation did (engine.ts) —
    // sampled against THIS image, not copied from the pre-edit branded URL.
    const branding = await getBrandingConfig(input.userId);
    let finalUrl = uploaded.secure_url;
    if (branding.enabled && (branding.logoPublicId || branding.storeName?.trim())) {
      const placement = await resolveBrandingPlacement(uploaded.secure_url, branding.position, {
        mark: "light",
        brightness: 0.5,
      });
      finalUrl = applyBranding(uploaded.secure_url, branding, placement);
    }

    void recordAiUsage({
      provider: "gemini",
      model: modelId,
      feature,
      operation: "erase_region",
      inputTokens: tokenInput,
      outputTokens: tokenOutput,
      totalTokens: tokenTotal,
      imagesGenerated: 1,
      imageInputs,
      requestBytes,
      responseBytes: editedRaw.length,
      durationMs: generationMs,
      storeId,
      userId: usageUserId,
      productId: input.productId,
      status: "success",
      metadata: {
        outputUrl: finalUrl,
        composited: true,
        outputImage: {
          mime: storedMime,
          sizeBytes: storedBuffer.length,
          widthPx: outDims?.width ?? origWidth,
          heightPx: outDims?.height ?? origHeight,
        },
      },
    });

    return {
      url: finalUrl,
      width: outDims?.width ?? origWidth,
      height: outDims?.height ?? origHeight,
      bytes: storedBuffer.length,
      model: modelId,
    };
  } catch (err) {
    console.error("[erase] region edit failed:", err);
    return null;
  }
}

import { readFile } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { uploadWithRetry } from "@/lib/cloudinary";
import { getImageDimensions, fmtBytes } from "@/lib/image-utils";
import { recordAiUsage, type AiUsageContext } from "@/lib/ai-usage/record";
import { getBrandingConfig, applyBranding } from "@/lib/model-gen/branding";
import { preprocessProductImage } from "@/lib/images/preprocess";
import { reencodeGeneratedImage } from "@/lib/images/reencode";
import { getQualityProfile, type GenerationQuality } from "@/lib/model-gen/quality";

const GEMINI_MODEL = "gemini-3.1-flash-image";

/** Build a prompt tailored to the product category and gender */
function buildPrompt(category: string, color: string, gender: string, detailNotes?: string | null): string {
  const cat = category.toLowerCase();
  const isWomen = gender !== "MEN";

  const subject = isWomen
    ? "a beautiful Indian woman, 25 years old, elegant posture"
    : "a well-dressed Indian man, 30 years old, confident stance";

  const setting =
    "professional fashion photography studio, soft diffused lighting, clean white background, high resolution, photorealistic";

  const detail = detailNotes?.trim()
    ? ` Faithfully preserve these product specifics: ${detailNotes.trim()}.`
    : "";

  if (["jewellery", "clutch", "handbag"].includes(cat)) {
    return `Close-up fashion photograph of ${subject} wearing/holding this ${category}. ${setting}.${detail}`;
  }
  if (["footwear"].includes(cat)) {
    return `Fashion photograph showing ${subject} wearing these shoes. Full or half body shot. ${setting}.${detail}`;
  }
  return `Full body fashion photograph of ${subject} wearing this ${color} ${category}. The garment is clearly visible and styled naturally. ${setting}.${detail}`;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp", gif: "image/gif",
};

export interface SourceImage {
  buffer: Buffer;
  mime: string;
}

/**
 * Fetch a product image (Cloudinary/http URL or a local /uploads/ path) as a
 * Buffer plus its MIME type. Returns null on any failure — model-image
 * generation is fire-and-forget, so callers skip rather than throw.
 *
 * Exported so the model-gen engine (lib/model-gen) can reuse the exact same
 * source-loading strategy instead of duplicating it.
 */
export async function fetchProductImageBuffer(
  imageUrl: string
): Promise<SourceImage | null> {
  let buffer: Buffer;
  let mimeHint = "image/jpeg";

  if (imageUrl.startsWith("http")) {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.error(`[model-image] failed to fetch image: ${imageUrl}`);
      return null;
    }
    mimeHint = res.headers.get("content-type") ?? "image/jpeg";
    buffer = Buffer.from(await res.arrayBuffer());
  } else if (imageUrl.startsWith("/uploads/")) {
    const localPath = join(process.cwd(), "public", imageUrl);
    try {
      buffer = await readFile(localPath);
    } catch {
      console.error(`[model-image] source file not found: ${localPath}`);
      return null;
    }
  } else {
    return null;
  }

  const ext = imageUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = MIME_BY_EXT[ext] ?? mimeHint;
  return { buffer, mime };
}

export interface GeminiImageGenInput {
  productId: string;
  productTitle: string;
  productCategory: string;
  productColor: string;
  /** The product garment image bytes. */
  productBuffer: Buffer;
  productMime: string;
  /**
   * Optional reference-model image (the "person"). When present it is sent as
   * the first image part so Gemini dresses that model — improving draping
   * consistency. When absent, behavior is identical to the original flow.
   */
  referenceBuffer?: Buffer | null;
  referenceMime?: string | null;
  /** Fully-composed text prompt. */
  prompt: string;
  /** Cloudinary folder. Defaults to the legacy "product-match/models". */
  folder?: string;
  /** View label for tags/logging (e.g. "front", "back"). Defaults to "model". */
  view?: string;
  /**
   * Cost-attribution context. When omitted, usage records under "model_gen".
   * Strategies pass their objective feature ("catalogue" | "quick_listing").
   */
  usage?: AiUsageContext;
  /** Native output quality. Defaults to "standard" (1K, 3:4) — see lib/model-gen/quality.ts. */
  quality?: GenerationQuality;
  /**
   * Additional labelled reference images (region close-ups — pallu, border,
   * …) shown to the generator so it reproduces those regions from PIXELS, not
   * only the text note. Preprocessed and appended AFTER the product image in
   * order; the prompt (buildViewPrompt) enumerates them starting at Image 3
   * (with a reference model) or Image 2 (without). Keep the count small — each
   * adds input tokens.
   */
  extraReferences?: Array<{ buffer: Buffer; mime: string; label: string }>;
}

/**
 * Run a single Gemini image generation and upload the result to Cloudinary.
 *
 * This is the shared core behind both the legacy single-image flow
 * (generateModelImage) and the model-gen catalogue/quick-listing strategies.
 * It performs NO database writes — the caller decides what to persist — and
 * never throws (model-image generation is a nice-to-have). Returns the uploaded
 * URL, or null on any failure.
 */
export async function runGeminiImageGen(
  input: GeminiImageGenInput
): Promise<{ url: string; width: number | null; height: number | null; bytes: number; model: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") return null;

  const {
    productId, productTitle, productCategory, productColor,
    productBuffer, productMime, referenceBuffer, referenceMime,
    prompt, folder = "product-match/models", view = "model", usage, quality,
    extraReferences = [],
  } = input;
  const qualityProfile = getQualityProfile(quality);

  const feature = usage?.feature ?? "model_gen";
  const storeId = usage?.storeId ?? null;
  const usageUserId = usage?.userId ?? null;

  try {
    const hasReference = Boolean(referenceBuffer && referenceMime);

    // Controlled Lanczos+sharpen downscale + high-quality encode before the model
    // sees it — a deliberate, faithful input instead of Gemini's blind internal
    // downsample of the full upload. Non-fatal (falls back to the original).
    const { buffer: modelInputBuffer, mime: modelInputMime } =
      await preprocessProductImage(productBuffer, productMime);

    // Reference-model assets are static, curated photos stored well above the
    // model's effective input resolution (e.g. up to ~1700px PNGs). Same
    // preprocessing as the product image — Gemini's own internal cap makes the
    // extra pixels pure token cost with no perceptible gain.
    const processedReference = hasReference
      ? await preprocessProductImage(referenceBuffer!, referenceMime!)
      : null;

    // Region reference close-ups (pallu/border/…), same preprocessing. Shown to
    // the generator so distinctive regions are reproduced from pixels, not just
    // the note. Non-fatal per image — a bad one is skipped, generation proceeds.
    const processedExtras: Array<{ mime: string; buffer: Buffer }> = [];
    for (const ref of extraReferences) {
      try {
        const p = await preprocessProductImage(ref.buffer, ref.mime);
        processedExtras.push({ mime: p.mime, buffer: p.buffer });
      } catch {
        /* skip a bad reference image */
      }
    }

    const imageInputs = (hasReference ? 2 : 1) + processedExtras.length;
    const requestBytes =
      modelInputBuffer.length +
      (processedReference ? processedReference.buffer.length : 0) +
      processedExtras.reduce((n, e) => n + e.buffer.length, 0);

    // Image parts, in the SAME order the prompt enumerates them: reference model
    // first (if any), then the product garment, then region reference close-ups
    // (Image 3+). Text last.
    const parts: Array<Record<string, unknown>> = [];
    if (processedReference) {
      parts.push({
        inline_data: { mime_type: processedReference.mime, data: processedReference.buffer.toString("base64") },
      });
    }
    parts.push({
      inline_data: { mime_type: modelInputMime, data: modelInputBuffer.toString("base64") },
    });
    for (const e of processedExtras) {
      parts.push({ inline_data: { mime_type: e.mime, data: e.buffer.toString("base64") } });
    }
    parts.push({ text: prompt });

    const inputDims = getImageDimensions(modelInputBuffer, modelInputMime);
    console.log(`[model-image] ── Gemini gen (${view}) ────────────────────────`);
    console.log(`[model-image] Product: ${productTitle} (${productCategory} · ${productColor})  reference=${hasReference}`);
    console.log(`[model-image] Product image (preprocessed): ${fmtBytes(modelInputBuffer.length)}  mime=${modelInputMime}  ${inputDims ? `${inputDims.width}×${inputDims.height}px` : "dims=unknown"}`);
    console.log(`[model-image] Quality: ${qualityProfile.id} (imageSize=${qualityProfile.imageSize}, aspectRatio=${qualityProfile.aspectRatio})`);

    const t0 = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
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
    console.log(`[model-image] Gemini responded: ${res.status}  (${generationMs} ms)`);

    if (!res.ok) {
      const err = await res.text();
      console.error(`[model-image] Gemini error ${res.status}:`, err.slice(0, 200));
      void recordAiUsage({
        provider: "gemini",
        model: GEMINI_MODEL,
        feature,
        operation: view,
        durationMs: generationMs,
        requestBytes,
        imageInputs,
        storeId,
        userId: usageUserId,
        productId,
        status: "error",
        errorMessage: `HTTP ${res.status}: ${err.slice(0, 300)}`,
      });
      return null;
    }

    const data = await res.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const usageMeta = data.usageMetadata;
    const tokenInput  = usageMeta?.promptTokenCount     ?? null;
    const tokenOutput = usageMeta?.candidatesTokenCount ?? null;
    const tokenTotal  = usageMeta?.totalTokenCount      ?? null;

    const responseParts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = responseParts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.data
    );
    if (!imagePart) {
      const finishReason = data.candidates?.[0]?.finishReason;
      console.error(`[model-image] No image in Gemini response (finish: ${finishReason})`);
      void recordAiUsage({
        provider: "gemini",
        model: GEMINI_MODEL,
        feature,
        operation: view,
        inputTokens: tokenInput,
        outputTokens: tokenOutput,
        totalTokens: tokenTotal,
        durationMs: generationMs,
        requestBytes,
        imageInputs,
        storeId,
        userId: usageUserId,
        productId,
        status: "error",
        errorMessage: `No image returned. Finish reason: ${finishReason ?? "unknown"}`,
      });
      return null;
    }

    const outMime = imagePart.inlineData!.mimeType ?? "image/jpeg";
    const outBuffer = Buffer.from(imagePart.inlineData!.data, "base64");
    console.log(`[model-image] Output (raw from Gemini): ${fmtBytes(outBuffer.length)}  mime=${outMime}`);

    // Re-encode before storing — Gemini's own JPEG encoder is not size-optimal
    // (see lib/images/reencode.ts). Same pixels, ~80% smaller, no perceptible
    // quality change (docs/research/IMAGE_RND_LOG.md, 2026-07-04).
    const { buffer: storedBuffer, mime: storedMime } = await reencodeGeneratedImage(outBuffer, outMime);
    const outDims = getImageDimensions(storedBuffer, storedMime);
    console.log(`[model-image] Output (re-encoded, stored): ${fmtBytes(storedBuffer.length)}  mime=${storedMime}  ${outDims ? `${outDims.width}×${outDims.height}px` : "dims=unknown"}`);

    // Store the result. This runs AFTER the generation is already paid for, so
    // it gets its own error handling: an extended timeout (observed 2026-07-14:
    // Cloudinary API degradation pushed a trivial ping to ~17s, blowing the
    // 60s SDK default on real uploads), one retry for transient failures, and
    // — if it still fails — a usage record with the real token counts so the
    // paid generation never vanishes from the cost ledger.
    const dataUri = `data:${storedMime};base64,${storedBuffer.toString("base64")}`;
    const uploadOptions = {
      folder,
      timeout: 120_000,
      tags: [
        `product:${productId}`,
        `category:${productCategory}`,
        `color:${productColor}`,
        `view:${view}`,
      ],
      context: {
        product_id:    productId,
        product_title: productTitle,
        category:      productCategory,
        color:         productColor,
        view,
        generated_at:  new Date().toISOString(),
      },
    };
    let uploaded: { secure_url: string } | null = null;
    let uploadError: unknown = null;
    try {
      uploaded = await uploadWithRetry(dataUri, uploadOptions);
    } catch (err) {
      uploadError = err;
      console.error(
        "[model-image] Cloudinary upload failed after retries (Gemini generation itself SUCCEEDED):",
        err
      );
    }
    if (!uploaded) {
      const e = uploadError as { error?: { message?: string; http_code?: number } ; message?: string } | null;
      const detail = e?.error?.message ?? e?.message ?? String(uploadError);
      void recordAiUsage({
        provider: "gemini",
        model: GEMINI_MODEL,
        feature,
        operation: view,
        inputTokens: tokenInput,
        outputTokens: tokenOutput,
        totalTokens: tokenTotal,
        imagesGenerated: 1,
        imageInputs,
        requestBytes,
        responseBytes: outBuffer.length,
        durationMs: generationMs,
        storeId,
        userId: usageUserId,
        productId,
        status: "error",
        errorMessage: `cloudinary_upload: ${String(detail).slice(0, 250)}`,
      });
      return null;
    }
    console.log(`[model-image] Uploaded: ${uploaded.secure_url}`);

    // ── Record AI usage (cost ledger) ───────────────────────────────────────
    const inputImages: Array<Record<string, unknown>> = [];
    if (processedReference) {
      const refDims = getImageDimensions(processedReference.buffer, processedReference.mime);
      inputImages.push({
        label: "reference-model", mime: processedReference.mime, sizeBytes: processedReference.buffer.length,
        widthPx: refDims?.width ?? null, heightPx: refDims?.height ?? null,
      });
    }
    inputImages.push({
      label: "product-image", mime: modelInputMime, sizeBytes: modelInputBuffer.length,
      widthPx: inputDims?.width ?? null, heightPx: inputDims?.height ?? null,
    });

    void recordAiUsage({
      provider: "gemini",
      model: GEMINI_MODEL,
      feature,
      operation: view,
      inputTokens: tokenInput,
      outputTokens: tokenOutput,
      totalTokens: tokenTotal,
      imagesGenerated: 1,
      imageInputs,
      requestBytes,
      responseBytes: outBuffer.length,
      durationMs: generationMs,
      storeId,
      userId: usageUserId,
      productId,
      status: "success",
      metadata: {
        outputUrl: uploaded.secure_url,
        category: productCategory,
        color: productColor,
        view,
        inputImages,
        outputImage: {
          // Raw = what Gemini billed for (tokens correlate with this). Stored =
          // what we actually persist/serve, after the post-generation re-encode.
          mime: outMime, sizeBytes: outBuffer.length,
          widthPx: outDims?.width ?? null, heightPx: outDims?.height ?? null,
          storedMime, storedSizeBytes: storedBuffer.length,
        },
      },
    });

    return {
      url: uploaded.secure_url,
      width: outDims?.width ?? null,
      height: outDims?.height ?? null,
      bytes: storedBuffer.length,
      model: GEMINI_MODEL,
    };
  } catch (err) {
    // Upload failures are handled (and usage-recorded) above and no longer
    // reach here — anything landing in this catch is a genuine generation /
    // preprocessing failure. Observed 2026-07-14: a Cloudinary upload timeout
    // surfacing through this catch was misread as a Gemini failure, hence the
    // explicit label.
    console.error("[model-image] generation failed (before upload stage):", err);
    return null;
  }
}

/**
 * Generates a model image for a product using Gemini image generation.
 * Reads the product image from Cloudinary or public/uploads, sends it to
 * Gemini, saves the result, and updates the product record.
 *
 * This is the original single-image flow — unchanged in behavior other than
 * the optional quality param. The richer objective-based generation lives in
 * lib/model-gen and reuses the helpers above. Fire-and-forget safe — all
 * errors are caught internally.
 */
export async function generateModelImage(productId: string, quality?: GenerationQuality): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") return;

  try {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product?.imageUrl) return;

    const source = await fetchProductImageBuffer(product.imageUrl);
    if (!source) return;

    // Prompt enrichment (front-only path). Dynamic import avoids a static import
    // cycle (detail-notes imports fetchProductImageBuffer from this module).
    const { ensureDetailNotes } = await import("@/lib/metadata/detail-notes");
    const detailNotes = await ensureDetailNotes(productId, product.imageUrl, product.category, {
      storeId: product.userId,
      userId: product.userId,
    });

    const prompt = buildPrompt(product.category, product.color, product.gender, detailNotes);
    const result = await runGeminiImageGen({
      productId,
      productTitle:    product.title,
      productCategory: product.category,
      productColor:    product.color,
      productBuffer:   source.buffer,
      productMime:     source.mime,
      prompt,
      usage: { feature: "model_gen", storeId: product.userId, userId: product.userId },
      quality,
    });
    if (!result) return;

    // Apply store branding (logo/name) so the legacy single-image path matches
    // the objective-based flow. No-op when branding is disabled or unset.
    const branding = await getBrandingConfig(product.userId);
    const finalUrl = applyBranding(result.url, branding);

    // Typed Prisma update (updatedAt is @updatedAt) — the previous raw query
    // used SQLite's datetime('now'), invalid on Postgres.
    await db.product.update({
      where: { id: productId },
      data: { modelImageUrl: finalUrl },
    });
  } catch (err) {
    console.error("[model-image] Unexpected error:", err);
  }
}

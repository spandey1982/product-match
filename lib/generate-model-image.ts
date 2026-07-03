import { readFile } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import { getImageDimensions, fmtBytes } from "@/lib/image-utils";
import { recordAiUsage, type AiUsageContext } from "@/lib/ai-usage/record";
import { getBrandingConfig, applyBranding } from "@/lib/model-gen/branding";
import { preprocessProductImage } from "@/lib/images/preprocess";
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

    const imageInputs = hasReference ? 2 : 1;
    const requestBytes =
      modelInputBuffer.length + (hasReference ? referenceBuffer!.length : 0);

    // Image parts: reference model first (if any), then the product garment.
    const parts: Array<Record<string, unknown>> = [];
    if (hasReference) {
      parts.push({
        inline_data: { mime_type: referenceMime, data: referenceBuffer!.toString("base64") },
      });
    }
    parts.push({
      inline_data: { mime_type: modelInputMime, data: modelInputBuffer.toString("base64") },
    });
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
    const outDims = getImageDimensions(outBuffer, outMime);
    console.log(`[model-image] Output: ${fmtBytes(outBuffer.length)}  mime=${outMime}  ${outDims ? `${outDims.width}×${outDims.height}px` : "dims=unknown"}`);

    const dataUri = `data:${outMime};base64,${imagePart.inlineData!.data}`;
    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder,
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
    });
    console.log(`[model-image] Uploaded: ${uploaded.secure_url}`);

    // ── Record AI usage (cost ledger) ───────────────────────────────────────
    const inputImages: Array<Record<string, unknown>> = [];
    if (hasReference) {
      const refDims = getImageDimensions(referenceBuffer!, referenceMime!);
      inputImages.push({
        label: "reference-model", mime: referenceMime!, sizeBytes: referenceBuffer!.length,
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
          mime: outMime, sizeBytes: outBuffer.length,
          widthPx: outDims?.width ?? null, heightPx: outDims?.height ?? null,
        },
      },
    });

    return {
      url: uploaded.secure_url,
      width: outDims?.width ?? null,
      height: outDims?.height ?? null,
      bytes: outBuffer.length,
      model: GEMINI_MODEL,
    };
  } catch (err) {
    console.error("[model-image] Gemini gen error:", err);
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

import { readFile } from "fs/promises";
import { join } from "path";
import { cloudinary } from "@/lib/cloudinary";
import { getImageDimensions, fmtBytes } from "@/lib/image-utils";
import { recordAiUsage, type AiUsageContext } from "@/lib/ai-usage/record";

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-3.1-flash-image";

export const TRYON_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type TryOnMimeType = (typeof TRYON_ALLOWED_MIME_TYPES)[number];

// ─── Upload validation helpers ────────────────────────────────────────────────
// Shared by every try-on route (retailer catalog + public rental) so the
// magic-byte check and rate limiter can't drift between call sites.

/**
 * Validates that file bytes actually match a declared image type. Prevents
 * malicious uploads that disguise non-images as JPEG/PNG/WebP.
 */
export function detectImageMimeFromBytes(buf: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";

  // WebP: RIFF....WEBP (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";

  return null;
}

/**
 * In-memory sliding-window rate limiter. Each call site should create its own
 * instance (module-level, per-process — sufficient for a single-instance
 * Railway deployment) keyed by whatever identity makes sense for that route.
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, number[]>();
  return function consume(key: string): boolean {
    const now = Date.now();
    const recent = (store.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= maxRequests) return false;
    recent.push(now);
    store.set(key, recent);
    return true;
  };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds a try-on prompt tailored to the product category.
 *
 * The prompt references the positional order of the two inline images sent to
 * Gemini: first image = person, second image = garment / accessory.
 */
function buildTryOnPrompt(category: string, color: string): string {
  const cat = category.toLowerCase();

  if (["jewellery"].includes(cat)) {
    return (
      `Fashion photograph of the person shown in the first image, ` +
      `now wearing the jewellery shown in the second image. ` +
      `Preserve the person's face, skin tone, and pose exactly. ` +
      `The jewellery should appear naturally worn and clearly visible. ` +
      `Professional fashion photography, soft studio lighting, photorealistic, high resolution.`
    );
  }

  if (["footwear"].includes(cat)) {
    return (
      `Fashion photograph of the person shown in the first image, ` +
      `now wearing the footwear shown in the second image. ` +
      `Show the full or half body so the footwear is clearly visible. ` +
      `Preserve the person's appearance, pose, and proportions exactly. ` +
      `Professional fashion photography, clean background, photorealistic, high resolution.`
    );
  }

  if (["clutch", "handbag"].includes(cat)) {
    return (
      `Fashion photograph of the person shown in the first image, ` +
      `now holding the ${category} shown in the second image. ` +
      `The ${category} should appear naturally carried in the person's hand. ` +
      `Preserve the person's appearance and pose exactly. ` +
      `Professional fashion photography, photorealistic, high resolution.`
    );
  }

  // Default: garment categories (saree, lehenga, kurta, suit, anarkali, etc.)
  return (
    `Full body fashion photograph of the person shown in the first image ` +
    `wearing the ${color} ${category} shown in the second image. ` +
    `The garment should be shown draped or fitted naturally on the person's body. ` +
    `Preserve the person's face, skin tone, hair, body proportions, and pose as closely as possible. ` +
    `The result should look like a realistic fashion editorial photograph. ` +
    `Professional studio lighting, clean background, high resolution, photorealistic.`
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TryOnInput {
  /** Cloudinary or other external URL of the product image. */
  productImageUrl: string;
  /** Raw bytes of the user-uploaded photo. Never persisted. */
  userPhotoBuffer: Buffer;
  /** Validated MIME type of the user photo derived from magic bytes. */
  userPhotoMimeType: TryOnMimeType;
  productCategory: string;
  productColor: string;
  /** Used for Cloudinary tags and research log. */
  productId: string;
  /** Optional — enriches logs and the usage record. */
  productTitle?: string;
  /** Optional — enriches logs and the usage record. */
  userId?: string;
  /**
   * Optional cost-attribution context. When omitted, usage is recorded under
   * the "tryon" feature with input.userId. Model-gen strategies pass their own
   * feature (e.g. "catalogue") so the same physical call attributes correctly.
   */
  usage?: AiUsageContext;
}

export interface TryOnResult {
  /** Cloudinary URL of the generated try-on image. */
  url: string;
  /** Output image facts (optional) — used for generation analytics. */
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  model?: string;
}

// ─── Core generation function ─────────────────────────────────────────────────

/**
 * Generates a virtual try-on image using the Gemini image generation API.
 *
 * Both the user's photo and the product image are sent as inline data to a
 * single Gemini request. The user's photo is used only for the duration of
 * the API call and is never written to disk or cloud storage. Only the
 * generated output image is persisted (Cloudinary, product-match/tryon/).
 *
 * Throws on any failure — callers are responsible for mapping errors to HTTP
 * responses.
 */
export async function generateTryOn(input: TryOnInput): Promise<TryOnResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const {
    productImageUrl,
    userPhotoBuffer,
    userPhotoMimeType,
    productCategory,
    productColor,
    productId,
    productTitle = productId,
    userId = "unknown",
  } = input;

  // ── Fetch product image — mirrors generate-model-image.ts strategy ──────
  let productBuffer: Buffer;
  let productMimeHint = "image/jpeg";

  if (productImageUrl.startsWith("http")) {
    const productRes = await fetch(productImageUrl);
    if (!productRes.ok) {
      throw new Error(
        `Failed to fetch product image (HTTP ${productRes.status})`
      );
    }
    productMimeHint = productRes.headers.get("content-type") ?? "image/jpeg";
    productBuffer = Buffer.from(await productRes.arrayBuffer());
  } else if (productImageUrl.startsWith("/uploads/")) {
    const localPath = join(process.cwd(), "public", productImageUrl);
    try {
      productBuffer = await readFile(localPath);
    } catch {
      throw new Error(`Product image file not found: ${localPath}`);
    }
  } else {
    throw new Error(`Unsupported product image URL format: ${productImageUrl}`);
  }

  const ext = productImageUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const productMime = mimeMap[ext] ?? productMimeHint;

  // ── Log input image metadata ─────────────────────────────────────────────
  const userDims = getImageDimensions(userPhotoBuffer, userPhotoMimeType);
  const productDims = getImageDimensions(productBuffer, productMime);

  console.log(`[tryon] ── Input images ──────────────────────────────────────`);
  console.log(`[tryon] User photo   : ${fmtBytes(userPhotoBuffer.length)}  mime=${userPhotoMimeType}  ${userDims ? `${userDims.width}×${userDims.height}px` : "dims=unknown"}`);
  console.log(`[tryon] Product image: ${fmtBytes(productBuffer.length)}  mime=${productMime}  ${productDims ? `${productDims.width}×${productDims.height}px` : "dims=unknown"}`);
  console.log(`[tryon] Product: ${productTitle} (${productCategory} · ${productColor})`);
  console.log(`[tryon] Calling Gemini model: ${GEMINI_MODEL}`);

  // ── Build request ────────────────────────────────────────────────────────
  const prompt = buildTryOnPrompt(productCategory, productColor);
  const userBase64 = userPhotoBuffer.toString("base64");
  const productBase64 = productBuffer.toString("base64");

  const t0 = Date.now();

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: userPhotoMimeType, data: userBase64 } },
              { inline_data: { mime_type: productMime, data: productBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
        },
      }),
    }
  );

  const generationMs = Date.now() - t0;
  console.log(`[tryon] Gemini responded: ${geminiRes.status}  (${generationMs} ms)`);

  const feature = input.usage?.feature ?? "tryon";
  const storeId = input.usage?.storeId ?? null;
  const usageUserId = input.usage?.userId ?? (userId === "unknown" ? null : userId);
  const requestBytes = userPhotoBuffer.length + productBuffer.length;

  if (!geminiRes.ok) {
    const body = await geminiRes.text();
    void recordAiUsage({
      provider: "gemini",
      model: GEMINI_MODEL,
      feature,
      operation: "tryon",
      durationMs: generationMs,
      requestBytes,
      imageInputs: 2,
      storeId,
      userId: usageUserId,
      productId,
      status: "error",
      errorMessage: `HTTP ${geminiRes.status}: ${body.slice(0, 300)}`,
    });
    throw new Error(
      `Gemini API error ${geminiRes.status}: ${body.slice(0, 300)}`
    );
  }

  // ── Parse response ───────────────────────────────────────────────────────
  const data = await geminiRes.json() as {
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

  // ── Log token usage ──────────────────────────────────────────────────────
  const usage = data.usageMetadata;
  const tokenInput  = usage?.promptTokenCount     ?? null;
  const tokenOutput = usage?.candidatesTokenCount ?? null;
  const tokenTotal  = usage?.totalTokenCount      ?? null;
  console.log(`[tryon] Tokens — input: ${tokenInput ?? "n/a"}  output: ${tokenOutput ?? "n/a"}  total: ${tokenTotal ?? "n/a"}`);

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData) {
    const finishReason = data.candidates?.[0]?.finishReason ?? "unknown";
    void recordAiUsage({
      provider: "gemini",
      model: GEMINI_MODEL,
      feature,
      operation: "tryon",
      inputTokens: tokenInput,
      outputTokens: tokenOutput,
      totalTokens: tokenTotal,
      durationMs: generationMs,
      requestBytes,
      imageInputs: 2,
      storeId,
      userId: usageUserId,
      productId,
      status: "error",
      errorMessage: `No image returned. Finish reason: ${finishReason}`,
    });
    throw new Error(
      `No image returned by Gemini. Finish reason: ${finishReason}`
    );
  }

  // ── Log output image metadata ────────────────────────────────────────────
  const outMime = imagePart.inlineData.mimeType ?? "image/jpeg";
  const outBuffer = Buffer.from(imagePart.inlineData.data, "base64");
  const outDims = getImageDimensions(outBuffer, outMime);

  console.log(`[tryon] ── Output image ─────────────────────────────────────`);
  console.log(`[tryon] Size: ${fmtBytes(outBuffer.length)}  mime=${outMime}  ${outDims ? `${outDims.width}×${outDims.height}px` : "dims=unknown"}`);

  // ── Upload result to Cloudinary ──────────────────────────────────────────
  const dataUri = `data:${outMime};base64,${imagePart.inlineData.data}`;

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: "product-match/tryon",
    tags: [
      `product:${productId}`,
      `category:${productCategory}`,
      `color:${productColor}`,
      `user:${userId}`,
    ],
    context: {
      product_id:    productId,
      product_title: productTitle,
      category:      productCategory,
      color:         productColor,
      generated_at:  new Date().toISOString(),
    },
  });

  console.log(`[tryon] Uploaded to Cloudinary: ${uploaded.secure_url}`);

  // ── Record AI usage (cost ledger) ────────────────────────────────────────
  void recordAiUsage({
    provider: "gemini",
    model: GEMINI_MODEL,
    feature,
    operation: "tryon",
    inputTokens: tokenInput,
    outputTokens: tokenOutput,
    totalTokens: tokenTotal,
    imagesGenerated: 1,
    imageInputs: 2,
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
      inputImages: [
        { label: "user-photo", mime: userPhotoMimeType, sizeBytes: userPhotoBuffer.length, widthPx: userDims?.width ?? null, heightPx: userDims?.height ?? null },
        { label: "product-image", mime: productMime, sizeBytes: productBuffer.length, widthPx: productDims?.width ?? null, heightPx: productDims?.height ?? null },
      ],
      outputImage: { mime: outMime, sizeBytes: outBuffer.length, widthPx: outDims?.width ?? null, heightPx: outDims?.height ?? null },
    },
  });

  return { url: uploaded.secure_url };
}

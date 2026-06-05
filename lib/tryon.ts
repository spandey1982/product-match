import { readFile } from "fs/promises";
import { join } from "path";
import { cloudinary } from "@/lib/cloudinary";

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = "nano-banana-pro-preview";

export const TRYON_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type TryOnMimeType = (typeof TRYON_ALLOWED_MIME_TYPES)[number];

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
  /** Used only as a Cloudinary tag for organisational purposes. */
  productId: string;
}

export interface TryOnResult {
  /** Cloudinary URL of the generated try-on image. */
  url: string;
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
  } = input;

  // ── Fetch product image — mirrors generate-model-image.ts strategy ──────
  let productBuffer: Buffer;
  let productMimeHint = "image/jpeg";

  if (productImageUrl.startsWith("http")) {
    // Cloudinary or other external URL
    const productRes = await fetch(productImageUrl);
    if (!productRes.ok) {
      throw new Error(
        `Failed to fetch product image (HTTP ${productRes.status})`
      );
    }
    productMimeHint = productRes.headers.get("content-type") ?? "image/jpeg";
    productBuffer = Buffer.from(await productRes.arrayBuffer());
  } else if (productImageUrl.startsWith("/uploads/")) {
    // Legacy local file stored in public/uploads/
    const localPath = join(process.cwd(), "public", productImageUrl);
    try {
      productBuffer = await readFile(localPath);
    } catch {
      throw new Error(`Product image file not found: ${localPath}`);
    }
  } else {
    throw new Error(`Unsupported product image URL format: ${productImageUrl}`);
  }

  // Infer MIME type from file extension, fall back to Content-Type or jpeg
  const ext = productImageUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const productMime = mimeMap[ext] ?? productMimeHint;

  // ── Build request ────────────────────────────────────────────────────────
  const prompt = buildTryOnPrompt(productCategory, productColor);
  const userBase64 = userPhotoBuffer.toString("base64");
  const productBase64 = productBuffer.toString("base64");

  // Part order matters: [person photo] → [garment photo] → [text instruction]
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

  if (!geminiRes.ok) {
    const body = await geminiRes.text();
    throw new Error(
      `Gemini API error ${geminiRes.status}: ${body.slice(0, 300)}`
    );
  }

  // ── Extract generated image ──────────────────────────────────────────────
  const data = await geminiRes.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> };
      finishReason?: string;
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData) {
    const finishReason = data.candidates?.[0]?.finishReason ?? "unknown";
    throw new Error(
      `No image returned by Gemini. Finish reason: ${finishReason}`
    );
  }

  // ── Upload result to Cloudinary ──────────────────────────────────────────
  // The user's photo is discarded here — only the output is persisted.
  const outMime = imagePart.inlineData.mimeType ?? "image/jpeg";
  const dataUri = `data:${outMime};base64,${imagePart.inlineData.data}`;

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: "product-match/tryon",
    tags: [`product:${productId}`],
  });

  return { url: uploaded.secure_url };
}

import { readFile } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import { getImageDimensions, fmtBytes } from "@/lib/image-utils";
import { appendResearchLog, type ImageMeta } from "@/lib/research-log";

const GEMINI_MODEL = "gemini-3.1-flash-image";

/** Build a prompt tailored to the product category and gender */
function buildPrompt(category: string, color: string, gender: string): string {
  const cat = category.toLowerCase();
  const isWomen = gender !== "MEN";

  const subject = isWomen
    ? "a beautiful Indian woman, 25 years old, elegant posture"
    : "a well-dressed Indian man, 30 years old, confident stance";

  const setting =
    "professional fashion photography studio, soft diffused lighting, clean white background, high resolution, photorealistic";

  if (["jewellery", "clutch", "handbag"].includes(cat)) {
    return `Close-up fashion photograph of ${subject} wearing/holding this ${category}. ${setting}.`;
  }
  if (["footwear"].includes(cat)) {
    return `Fashion photograph showing ${subject} wearing these shoes. Full or half body shot. ${setting}.`;
  }
  return `Full body fashion photograph of ${subject} wearing this ${color} ${category}. The garment is clearly visible and styled naturally. ${setting}.`;
}

/**
 * Generates a model image for a product using Gemini image generation.
 * Reads the product image from Cloudinary or public/uploads, sends it to
 * Gemini, saves the result, and updates the product record.
 * Fire-and-forget safe — all errors are caught internally.
 */
export async function generateModelImage(productId: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") return;

  try {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product?.imageUrl) return;

    // ── Read source image ─────────────────────────────────────────────────
    let imageBuffer: Buffer;
    let mimeTypeHint = "image/jpeg";

    if (product.imageUrl.startsWith("http")) {
      const fetchRes = await fetch(product.imageUrl);
      if (!fetchRes.ok) {
        console.error(`[model-image] failed to fetch image: ${product.imageUrl}`);
        return;
      }
      mimeTypeHint = fetchRes.headers.get("content-type") ?? "image/jpeg";
      imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
    } else if (product.imageUrl.startsWith("/uploads/")) {
      const localPath = join(process.cwd(), "public", product.imageUrl);
      try {
        imageBuffer = await readFile(localPath);
      } catch {
        console.error(`[model-image] source file not found: ${localPath}`);
        return;
      }
    } else {
      return;
    }

    const ext = product.imageUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", webp: "image/webp", gif: "image/gif",
    };
    const mimeType = mimeMap[ext] ?? mimeTypeHint;

    // ── Log input image metadata ──────────────────────────────────────────
    const inputDims = getImageDimensions(imageBuffer, mimeType);
    console.log(`[model-image] ── Input image ───────────────────────────────`);
    console.log(`[model-image] Product image: ${fmtBytes(imageBuffer.length)}  mime=${mimeType}  ${inputDims ? `${inputDims.width}×${inputDims.height}px` : "dims=unknown"}`);
    console.log(`[model-image] Product: ${product.title} (${product.category} · ${product.color})`);
    console.log(`[model-image] Calling Gemini model: ${GEMINI_MODEL}`);

    const prompt = buildPrompt(product.category, product.color, product.gender);
    const base64 = imageBuffer.toString("base64");

    const t0 = Date.now();

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: prompt },
            ],
          }],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        }),
      }
    );

    const generationMs = Date.now() - t0;
    console.log(`[model-image] Gemini responded: ${res.status}  (${generationMs} ms)`);

    if (!res.ok) {
      const err = await res.text();
      console.error(`[model-image] Gemini error ${res.status}:`, err.slice(0, 200));
      return;
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

    // ── Log token usage ───────────────────────────────────────────────────
    const usage = data.usageMetadata;
    const tokenInput  = usage?.promptTokenCount     ?? null;
    const tokenOutput = usage?.candidatesTokenCount ?? null;
    const tokenTotal  = usage?.totalTokenCount      ?? null;
    console.log(`[model-image] Tokens — input: ${tokenInput ?? "n/a"}  output: ${tokenOutput ?? "n/a"}  total: ${tokenTotal ?? "n/a"}`);

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    console.log(`[model-image] Parts received: ${parts.length}  finish: ${data.candidates?.[0]?.finishReason}`);

    const imagePart = parts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.data
    );

    if (!imagePart) {
      console.error("[model-image] No image in Gemini response");
      return;
    }

    // ── Log output image metadata ─────────────────────────────────────────
    const outMime = imagePart.inlineData!.mimeType ?? "image/jpeg";
    const outBuffer = Buffer.from(imagePart.inlineData!.data, "base64");
    const outDims = getImageDimensions(outBuffer, outMime);

    console.log(`[model-image] ── Output image ──────────────────────────────`);
    console.log(`[model-image] Size: ${fmtBytes(outBuffer.length)}  mime=${outMime}  ${outDims ? `${outDims.width}×${outDims.height}px` : "dims=unknown"}`);

    // ── Upload to Cloudinary ──────────────────────────────────────────────
    const dataUri = `data:${outMime};base64,${imagePart.inlineData!.data}`;
    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: "product-match/models",
      tags: [
        `product:${productId}`,
        `category:${product.category}`,
        `color:${product.color}`,
      ],
      context: {
        product_id:    productId,
        product_title: product.title,
        category:      product.category,
        color:         product.color,
        generated_at:  new Date().toISOString(),
      },
    });
    const modelImageUrl = uploaded.secure_url;

    await db.$executeRaw`UPDATE products SET "modelImageUrl" = ${modelImageUrl}, "updatedAt" = datetime('now') WHERE id = ${productId}`;

    console.log(`[model-image] Uploaded: ${modelImageUrl}`);

    // ── Write research log ────────────────────────────────────────────────
    const inputImageMeta: ImageMeta = {
      label:     "product-image",
      mime:      mimeType,
      sizeBytes: imageBuffer.length,
      widthPx:   inputDims?.width ?? null,
      heightPx:  inputDims?.height ?? null,
    };
    const outputImageMeta: ImageMeta = {
      label:     "model-output",
      mime:      outMime,
      sizeBytes: outBuffer.length,
      widthPx:   outDims?.width ?? null,
      heightPx:  outDims?.height ?? null,
    };

    await appendResearchLog({
      timestamp:       new Date().toISOString(),
      type:            "model",
      productId,
      productTitle:    product.title,
      productCategory: product.category,
      productColor:    product.color,
      userId:          "system",
      outputUrl:       modelImageUrl,
      generationMs,
      inputImages:     [inputImageMeta],
      outputImage:     outputImageMeta,
      tokens:
        tokenInput !== null && tokenOutput !== null && tokenTotal !== null
          ? { input: tokenInput, output: tokenOutput, total: tokenTotal }
          : null,
    });
  } catch (err) {
    console.error("[model-image] Unexpected error:", err);
  }
}

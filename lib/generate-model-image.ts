import { readFile } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";

const GEMINI_MODEL = "nano-banana-pro-preview";

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
 * Generates a model image for a product using nano-banana-pro-preview.
 * Reads the product image from public/uploads, sends it to Gemini,
 * saves the result, and updates the product record.
 * Fire-and-forget safe — all errors are caught internally.
 */
export async function generateModelImage(productId: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") return;

  try {
    // Fetch product
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product?.imageUrl) return;

    // Read source image — support both Cloudinary URLs and legacy local files
    let imageBuffer: Buffer;
    let mimeTypeHint = "image/jpeg";

    if (product.imageUrl.startsWith("http")) {
      // Cloudinary or any external URL — fetch directly
      const fetchRes = await fetch(product.imageUrl);
      if (!fetchRes.ok) {
        console.error(`[model-image] failed to fetch image: ${product.imageUrl}`);
        return;
      }
      mimeTypeHint = fetchRes.headers.get("content-type") ?? "image/jpeg";
      imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
    } else if (product.imageUrl.startsWith("/uploads/")) {
      // Legacy local file
      const localPath = join(process.cwd(), "public", product.imageUrl);
      try {
        imageBuffer = await readFile(localPath);
      } catch {
        console.error(`[model-image] source file not found: ${localPath}`);
        return;
      }
    } else {
      return; // unsupported URL format
    }

    const base64 = imageBuffer.toString("base64");
    // Detect mime type from extension or content-type header
    const ext = product.imageUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", webp: "image/webp", gif: "image/gif",
    };
    const mimeType = mimeMap[ext] ?? mimeTypeHint;

    const prompt = buildPrompt(product.category, product.color, product.gender);

    console.log(`[model-image] Calling nano-banana for product ${productId}`);

    // Call nano-banana
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

    console.log(`[model-image] Gemini responded: ${res.status}`);
    if (!res.ok) {
      const err = await res.text();
      console.error(`[model-image] Gemini error ${res.status}:`, err.slice(0, 200));
      return;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    console.log(`[model-image] Parts received: ${parts.length}, finish: ${data.candidates?.[0]?.finishReason}`);
    const imagePart = parts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.data
    );

    if (!imagePart) {
      console.error("[model-image] No image in Gemini response");
      return;
    }

    // Upload generated image to Cloudinary
    const outMime = imagePart.inlineData.mimeType ?? "image/jpeg";
    const dataUri = `data:${outMime};base64,${imagePart.inlineData.data}`;
    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: "product-match/models",
    });
    const modelImageUrl = uploaded.secure_url;

    // Update product record — use raw SQL to bypass any cached Prisma type mapping
    await db.$executeRaw`UPDATE products SET "modelImageUrl" = ${modelImageUrl}, "updatedAt" = datetime('now') WHERE id = ${productId}`;

    console.log(`[model-image] Generated for product ${productId}: ${modelImageUrl}`);
  } catch (err) {
    console.error("[model-image] Unexpected error:", err);
  }
}

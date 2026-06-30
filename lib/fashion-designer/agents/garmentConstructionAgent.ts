import { cloudinary } from "@/lib/cloudinary";
import type { GenerationPlan } from "../types";

// Gemini image generation model
const IMAGE_GEN_MODEL = "gemini-2.0-flash-preview-image-generation";

async function generateFlatImage(
  prompt: string,
  fabricImageUrl: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  // Fetch fabric image as reference
  const imgRes = await fetch(fabricImageUrl);
  const buffer = imgRes.ok ? Buffer.from(await imgRes.arrayBuffer()) : null;
  const mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";

  const parts: unknown[] = [];
  if (buffer) {
    parts.push({ inline_data: { mime_type: mimeType, data: buffer.toString("base64") } });
  }
  parts.push({ text: prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GEN_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      temperature: 0.4,
    },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        console.error(`[fashion-designer] image gen failed: HTTP ${res.status}`);
        return null;
      }

      const data = await res.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }
        }>
      };

      const responseParts = data.candidates?.[0]?.content?.parts ?? [];
      const imagePart = responseParts.find((p) => p.inlineData);
      if (!imagePart?.inlineData) {
        console.error("[fashion-designer] no image in response");
        return null;
      }

      // Upload base64 image to Cloudinary
      const dataUri = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: "product-match/fashion-designer",
      });
      return result.secure_url;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

export async function garmentConstructionAgent(
  plan: GenerationPlan,
  fabricImageUrls: string[]
): Promise<{ flatFrontUrl: string | null; flatBackUrl: string | null }> {
  const primaryFabricUrl = fabricImageUrls[0];

  // Generate front and back in parallel
  const [flatFrontUrl, flatBackUrl] = await Promise.all([
    generateFlatImage(plan.flatFrontPrompt, primaryFabricUrl),
    generateFlatImage(plan.flatBackPrompt, primaryFabricUrl),
  ]);

  return { flatFrontUrl, flatBackUrl };
}

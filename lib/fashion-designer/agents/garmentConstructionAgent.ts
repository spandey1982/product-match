import { cloudinary } from "@/lib/cloudinary";
import type { GenerationPlan } from "../types";

const IMAGE_GEN_MODEL = "gemini-3.1-flash-image";

async function fetchImagePart(url: string): Promise<{ inline_data: { mime_type: string; data: string } } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { inline_data: { mime_type: mime, data } };
  } catch {
    return null;
  }
}

async function generateFlatImage(
  prompt: string,
  imageParts: Array<{ inline_data: { mime_type: string; data: string } }>
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const parts: unknown[] = [
    ...imageParts,
    { text: prompt },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GEN_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"] },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[fashion-designer] image gen failed: HTTP ${res.status}`, errBody.slice(0, 400));
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        return null;
      }

      const data = await res.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> };
        }>;
      };

      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p) => p.inlineData?.data);
      if (!imagePart?.inlineData) {
        console.error("[fashion-designer] no image in response", JSON.stringify(data).slice(0, 200));
        return null;
      }

      const { mimeType, data: b64 } = imagePart.inlineData;
      const result = await cloudinary.uploader.upload(`data:${mimeType};base64,${b64}`, {
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
  referenceUrls: string[] = [],
): Promise<{ flatFrontUrl: string | null; flatBackUrl: string | null }> {
  // Fetch up to 4 reference images ONCE and reuse the same bytes for both the
  // front and back calls — identical images either way, just without fetching
  // and re-encoding each one twice.
  const imageParts = (
    await Promise.all(referenceUrls.slice(0, 4).map(fetchImagePart))
  ).filter((p): p is { inline_data: { mime_type: string; data: string } } => p !== null);

  const [flatFrontUrl, flatBackUrl] = await Promise.all([
    generateFlatImage(plan.flatFrontPrompt, imageParts),
    generateFlatImage(plan.flatBackPrompt, imageParts),
  ]);

  return { flatFrontUrl, flatBackUrl };
}

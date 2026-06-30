import { cloudinary } from "@/lib/cloudinary";
import type { GenerationPlan } from "../types";

const IMAGE_GEN_MODEL = "gemini-3.1-flash-image";

async function generateFlatImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GEN_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
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
      const dataUri = `data:${mimeType};base64,${b64}`;
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
): Promise<{ flatFrontUrl: string | null; flatBackUrl: string | null }> {
  const [flatFrontUrl, flatBackUrl] = await Promise.all([
    generateFlatImage(plan.flatFrontPrompt),
    generateFlatImage(plan.flatBackPrompt),
  ]);

  return { flatFrontUrl, flatBackUrl };
}

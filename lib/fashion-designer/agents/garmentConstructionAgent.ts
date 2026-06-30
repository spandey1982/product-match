import { cloudinary } from "@/lib/cloudinary";
import type { GenerationPlan } from "../types";

// Imagen 3 via Google AI Studio (same API key as Gemini)
const IMAGEN_MODEL = "imagen-3.0-generate-002";

async function generateFlatImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${apiKey}`;
  const body = JSON.stringify({
    instances: [{ prompt }],
    parameters: { sampleCount: 1, aspectRatio: "3:4" },
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
        predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
      };

      const prediction = data.predictions?.[0];
      if (!prediction?.bytesBase64Encoded) {
        console.error("[fashion-designer] no image bytes in Imagen response", JSON.stringify(data).slice(0, 200));
        return null;
      }

      const mimeType = prediction.mimeType ?? "image/png";
      const dataUri = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
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

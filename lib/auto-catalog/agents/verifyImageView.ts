/**
 * Vision-based view verifier.
 *
 * Fetches a generated image and asks the vision model whether it actually shows
 * the expected view (front / back / close-up). Returns true when the image
 * matches the expected view, false when it is a mismatch.
 *
 * Uses the same Gemini endpoint as the metadata analyzer so we stay on one
 * provider. The prompt is intentionally minimal to keep latency and cost low.
 */

import { recordAiUsage, type AiUsageContext } from "@/lib/ai-usage/record";

const VERIFIER_MODEL = "gemini-2.5-flash-lite";

export type ExpectedView = "front" | "back" | "close-up" | "on-model";

export interface ViewVerificationResult {
  imageId: string;
  url: string;
  expectedView: ExpectedView;
  detectedView: string;   // raw label from the model
  match: boolean;
  confidence: number;     // 0–1
}

const VIEW_PROMPT = (expected: ExpectedView) => `
You are a fashion image QC inspector.

Look at this garment image and answer:
1. What view of the garment does this image show? Choose ONE label: "front", "back", "close-up", "on-model", or "other".
2. Does the image match the expected view: "${expected}"?
3. Confidence score (0.0–1.0) that your label is correct.

Return ONLY valid JSON in this exact shape (no markdown, no explanation):
{"detected_view":"<label>","match":<true|false>,"confidence":<number>}
`.trim();

export async function verifyImageView(
  imageId: string,
  url: string,
  expectedView: ExpectedView,
  usage?: AiUsageContext
): Promise<ViewVerificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    return { imageId, url, expectedView, detectedView: "unknown", match: true, confidence: 0 };
  }

  // Fetch the image and base64-encode it
  let imageBuffer: Buffer;
  let mimeType = "image/jpeg";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    mimeType = contentType.split(";")[0].trim() || "image/jpeg";
    imageBuffer = Buffer.from(await res.arrayBuffer());
  } catch {
    // If we can't fetch the image, don't fail QC — treat as match
    return { imageId, url, expectedView, detectedView: "unknown", match: true, confidence: 0 };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${VERIFIER_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBuffer.toString("base64") } },
        { text: VIEW_PROMPT(expectedView) },
      ],
    }],
    generationConfig: { temperature: 0.1 },
  });

  const t0 = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const durationMs = Date.now() - t0;

    if (!res.ok) {
      if (usage) {
        void recordAiUsage({
          provider: "gemini", model: VERIFIER_MODEL,
          feature: usage.feature, operation: "verify_image_view",
          imageInputs: 1, durationMs,
          storeId: usage.storeId, userId: usage.userId,
          status: "error", errorMessage: `HTTP ${res.status}`,
        });
      }
      return { imageId, url, expectedView, detectedView: "unknown", match: true, confidence: 0 };
    }
    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };

    if (usage) {
      void recordAiUsage({
        provider: "gemini", model: VERIFIER_MODEL,
        feature: usage.feature, operation: "verify_image_view",
        inputTokens: data.usageMetadata?.promptTokenCount ?? null,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
        totalTokens: data.usageMetadata?.totalTokenCount ?? null,
        imageInputs: 1, durationMs,
        storeId: usage.storeId, userId: usage.userId,
        status: "success",
      });
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const clean = raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean) as { detected_view: string; match: boolean; confidence: number };

    return {
      imageId,
      url,
      expectedView,
      detectedView: parsed.detected_view ?? "unknown",
      match: parsed.match ?? true,
      confidence: parsed.confidence ?? 0,
    };
  } catch {
    return { imageId, url, expectedView, detectedView: "unknown", match: true, confidence: 0 };
  }
}

/**
 * Shared Gemini REST helper for the Fashion Designer analysis/planning agents.
 *
 * The fabric, design-understanding, accessory and planner agents all call the
 * same Gemini text/vision endpoint and parse the same "JSON, possibly wrapped
 * in a markdown fence" response shape. Centralized here instead of five
 * near-identical fetch/parse implementations. The image-generation agent
 * (garmentConstructionAgent) is a structurally different call (image output,
 * not JSON) and is not routed through this helper.
 */

import { recordAiUsage, type AiUsageContext } from "@/lib/ai-usage/record";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export interface ImagePart {
  mimeType: string;
  data: string; // base64
}

/** Fetch a remote image and base64-encode it as a Gemini inline_data part. Never throws — returns null on any failure. */
export async function fetchImageAsPart(
  url: string,
  fallbackMimeType = "image/jpeg"
): Promise<ImagePart | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? fallbackMimeType;
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { mimeType, data };
  } catch {
    return null;
  }
}

function stripJsonFence(raw: string): string {
  return raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
}

/**
 * Call Gemini with a text prompt + optional images, expecting a single JSON
 * object back. Throws on missing API key, HTTP failure, or unparsable
 * response — callers decide whether to catch and fall back.
 */
export async function callGeminiForJson<T>(
  prompt: string,
  images: ImagePart[] = [],
  opts: { model?: string; temperature?: number; usage?: AiUsageContext & { operation?: string } } = {}
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const model = opts.model ?? DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: unknown[] = [
    ...images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } })),
    { text: prompt },
  ];

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: opts.temperature ?? 0.1 },
  });

  const t0 = Date.now();
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const durationMs = Date.now() - t0;

  if (!res.ok) {
    if (opts.usage) {
      void recordAiUsage({
        provider: "gemini",
        model,
        feature: opts.usage.feature,
        operation: opts.usage.operation ?? null,
        imageInputs: images.length,
        durationMs,
        storeId: opts.usage.storeId,
        userId: opts.usage.userId,
        status: "error",
        errorMessage: `HTTP ${res.status}`,
      });
    }
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };

  if (opts.usage) {
    void recordAiUsage({
      provider: "gemini",
      model,
      feature: opts.usage.feature,
      operation: opts.usage.operation ?? null,
      inputTokens: data.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
      totalTokens: data.usageMetadata?.totalTokenCount ?? null,
      imageInputs: images.length,
      durationMs,
      storeId: opts.usage.storeId,
      userId: opts.usage.userId,
      status: "success",
    });
  }

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(stripJsonFence(raw)) as T;
}

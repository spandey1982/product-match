/**
 * Shared Gemini REST helper for Catalogue Motion's text-planning calls.
 *
 * Mirrors lib/fashion-designer/gemini-client.ts's shape exactly (same JSON
 * response convention: possibly markdown-fenced, no schema-validation
 * library, throws on malformed output). Kept as its own small per-domain
 * copy rather than importing the fashion-designer one — this repo's
 * established convention is a small local client per feature domain
 * (lib/model-gen/ai-review.ts and lib/generate-model-image.ts each have
 * their own too), not one shared cross-domain client.
 */

import { recordAiUsage, type AiUsageContext } from "@/lib/ai-usage/record";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

function stripJsonFence(raw: string): string {
  return raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
}

/**
 * Call Gemini with a text-only prompt, expecting a single JSON object back.
 * Throws on missing API key, HTTP failure, or unparsable response — callers
 * decide whether to catch and fall back.
 */
export async function callGeminiForJson<T>(
  prompt: string,
  opts: { model?: string; temperature?: number; usage?: AiUsageContext & { operation?: string } } = {}
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const model = opts.model ?? DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
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
      durationMs,
      storeId: opts.usage.storeId,
      userId: opts.usage.userId,
      status: "success",
    });
  }

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(stripJsonFence(raw)) as T;
}

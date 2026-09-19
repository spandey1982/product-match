/**
 * "Honest overview" — mandatory post-generation opinion pass over the
 * FINAL composited image (see docs/home-material/README.md, "Honest
 * overview" — the user's near-mandatory requirement from the 2026-09-08/09
 * multi-wall discussion). This is a vision-QA read of the actual result,
 * never a recommendation and never a bare numeric score exposed to the
 * customer — natural language only, and strictly tone-constrained: always
 * open positive, hedge any doubt softly instead of stating a flaw, never
 * use negative/blunt language, and always surface alternatives regardless
 * of how good the primary result is.
 *
 * The alternative options offered alongside the overview are chosen
 * DETERMINISTICALLY from the product catalogue (pickAlternativeProductIds
 * below) — never invented by the model — per the AI-boundaries rule that
 * the product database defines the product, the LLM doesn't (Constitution
 * Principle 7). This mirrors the same separation already enforced in
 * lib/home-material/recommendation.ts (deterministic scoring, no
 * LLM-invented judgments) and lib/home-material/wall-detection.ts
 * (structured facts only, never prose).
 */
import { recordAiUsage } from "@/lib/ai-usage/record";

const MODEL_ID = "gemini-2.5-flash";

// Belt-and-suspenders tone guard on top of the prompt instruction below —
// a bad word anywhere in the model's output drops that line entirely
// rather than showing it, since the user was explicit that this must
// NEVER read as negative or rude.
const FORBIDDEN_WORDS = [
  "wrong",
  "bad",
  "ugly",
  "clash",
  "clashes",
  "doesn't work",
  "don't work",
  "poor",
  "awful",
  "terrible",
  "ruin",
  "ruins",
  "hideous",
  "hate",
  "mistake",
  "regret",
];

export interface OverviewResult {
  opening: string;
  highlights: string[];
  considerations: string[];
  closing: string;
}

interface RawOverview {
  opening?: unknown;
  highlights?: unknown;
  considerations?: unknown;
  closing?: unknown;
}

function isClean(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN_WORDS.some((w) => lower.includes(w));
}

function sanitizeList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .filter(isClean)
    .slice(0, max);
}

/**
 * Never manufactures a result out of a malformed response (Constitution
 * Principle 4) — an opening/closing that fails the clean-tone check, or is
 * missing, means the whole overview is treated as failed, not patched.
 */
function parseOverview(raw: RawOverview): OverviewResult | null {
  const opening = typeof raw.opening === "string" ? raw.opening.trim() : "";
  const closing = typeof raw.closing === "string" ? raw.closing.trim() : "";
  if (!opening || !closing || !isClean(opening) || !isClean(closing)) return null;

  return {
    opening,
    highlights: sanitizeList(raw.highlights, 3),
    considerations: sanitizeList(raw.considerations, 2),
    closing,
  };
}

const PROMPT = `You are a warm, encouraging interior design assistant reviewing an AI-generated preview: a photo of a real room with a new wall material applied to one wall.

Give an honest, ALWAYS POSITIVE-IN-TONE take on how the new material looks in THIS specific room — its lighting, its other furnishings, its overall mood. A real customer will read this, so follow these rules strictly:

- Open with something genuine and specific you like about how it looks in this room — not generic praise, something tied to what you actually see (the light, the colours nearby, the mood it creates).
- List 1 to 3 concrete strengths: colour harmony, brightness, mood, how it complements the existing decor, etc.
- If you have any doubt or reservation, phrase it as a SOFT, HEDGED consideration — never as a flaw. Words like "wrong", "bad", "clashes", "doesn't work" are FORBIDDEN. Use gentle phrasing instead, e.g. "might feel even warmer with brighter lighting" or "could pair especially well with lighter curtains." If you have nothing worth softly mentioning, leave this list empty — never invent a doubt just to fill it.
- Close with one encouraging sentence giving your honest overall take, expressed positively regardless of how strong the match is.

Respond with ONLY this JSON shape, no other text:
{
  "opening": string,
  "highlights": string[] (1 to 3 items),
  "considerations": string[] (0 to 2 items, always gently hedged, never negative),
  "closing": string
}`;

export async function generateVisualizationOverview(params: {
  outputImageUrl: string;
  materialName: string;
  hmUserId: string;
  visualizationId: string;
}): Promise<OverviewResult | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    return { error: "Overview is not configured." };
  }

  let imageBuffer: Buffer;
  let mime = "image/jpeg";
  try {
    const res = await fetch(params.outputImageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    imageBuffer = Buffer.from(await res.arrayBuffer());
    mime = res.headers.get("content-type") || mime;
  } catch (err) {
    return { error: `Could not fetch the generated preview: ${String(err)}` };
  }

  const prompt = `${PROMPT}\n\nThe material applied to the wall is: ${params.materialName}`;
  const requestBytes = imageBuffer.length;
  const t0 = Date.now();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mime, data: imageBuffer.toString("base64") } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
        }),
      }
    );
    const durationMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      void recordAiUsage({
        provider: "gemini",
        model: MODEL_ID,
        feature: "hm_overview",
        durationMs,
        requestBytes,
        imageInputs: 1,
        userId: params.hmUserId,
        status: "error",
        errorMessage: `HTTP ${res.status}: ${errText.slice(0, 300)}`,
        metadata: { visualizationId: params.visualizationId },
      });
      return { error: "Could not generate an overview." };
    }

    const data = await res.json();
    const usageMeta = data.usageMetadata;
    const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_overview",
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs,
      requestBytes,
      imageInputs: 1,
      userId: params.hmUserId,
      status: "success",
      metadata: { visualizationId: params.visualizationId },
    });

    if (!text) return { error: "Overview returned no result." };

    let raw: RawOverview;
    try {
      raw = JSON.parse(text);
    } catch {
      return { error: "Overview returned an unreadable result." };
    }

    const parsed = parseOverview(raw);
    if (!parsed) return { error: "Overview did not pass tone validation." };
    return parsed;
  } catch (err) {
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_overview",
      requestBytes,
      imageInputs: 1,
      userId: params.hmUserId,
      status: "error",
      errorMessage: `fetch failed: ${String(err)}`,
      metadata: { visualizationId: params.visualizationId },
    });
    return { error: "Could not reach the overview service." };
  }
}

export interface AlternativeCandidate {
  id: string;
  category: string | null;
}

/**
 * Deterministic pick — never AI-invented (Constitution Principle 7).
 * Prefers other swatches in the same material category (a genuinely
 * comparable alternative), falls back to any other swatch if the category
 * doesn't have enough options. Always returns up to `limit` ids, even when
 * the primary result scored well — the user was explicit that alternatives
 * should show regardless of how good the outcome is.
 */
export function pickAlternativeProductIds(
  currentProductId: string,
  currentCategory: string | null,
  candidates: AlternativeCandidate[],
  limit = 3
): string[] {
  const others = candidates.filter((c) => c.id !== currentProductId);
  const sameCategory = currentCategory ? others.filter((c) => c.category === currentCategory) : [];
  const sameCategoryIds = new Set(sameCategory.map((c) => c.id));
  const rest = others.filter((c) => !sameCategoryIds.has(c.id));
  return [...sameCategory, ...rest].slice(0, limit).map((c) => c.id);
}

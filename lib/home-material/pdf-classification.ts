/**
 * AI classification pass for PDF-extracted candidate images (2026-09-17) —
 * the "hybrid" half of the catalogue-import tool. Deterministic extraction
 * (lib/home-material/pdf-import.ts) separates every big-enough embedded
 * image on a page but has zero concept of what role each one plays; a real
 * supplier PDF mixes clean product tiles with lifestyle photos, texture
 * close-ups, and multi-product group shots that all look identical to a
 * pure size/position heuristic. This module sends a page's candidate
 * images to Gemini vision to SUGGEST a role for each, never to decide —
 * every result stays fully editable and every candidate stays reachable in
 * the review queue regardless of what this says, including "noise" (never
 * miss a real product, per explicit instruction). Same proven pattern as
 * lib/home-material/wall-detection.ts: one generateContent call, images +
 * prompt in, structured JSON out, malformed/uncertain output dropped
 * rather than guessed.
 *
 * Batched per page (not one call per image): a real catalogue page can
 * hold 50+ candidate images, and one Gemini round-trip per image would
 * multiply an already-slow import (see docs/home-material/architecture/
 * system.md's "PDF extraction rework"). Batches of up to
 * MAX_IMAGES_PER_CALL keep each request's payload and token count bounded
 * while still cutting round-trips roughly 10x versus one-per-image.
 */
import { recordAiUsage } from "@/lib/ai-usage/record";

const MODEL_ID = "gemini-2.5-flash";
const MAX_IMAGES_PER_CALL = 8;

export type ImageRole = "clean_tile" | "lifestyle" | "texture_closeup" | "group_shot" | "noise";

const VALID_ROLES: readonly ImageRole[] = ["clean_tile", "lifestyle", "texture_closeup", "group_shot", "noise"];

export interface ImageClassification {
  role: ImageRole;
  confidence: number | null;
  finishGuess: string | null;
  colorHint: string | null;
}

const PROMPT_HEADER = `You are looking at photos extracted from a wallpaper supplier's PDF catalogue page, numbered in order below. Classify EACH photo independently into exactly one role:

- "clean_tile": a flat, straight-on photo showing ONLY the repeating wallpaper pattern itself — no room, no furniture, no multiple products side by side, no visible border/frame text beyond a product code. This is the single most valuable category — the actual usable product swatch. When in doubt between this and texture_closeup, prefer clean_tile if the overall repeating pattern layout is visible (not just an extreme close-up of the surface material).
- "lifestyle": a photo of a real or staged room (sofa, furniture, window, lamp, etc.) with the wallpaper applied to a wall. Good for marketing, not usable as a flat tiling swatch.
- "texture_closeup": an extreme close-up showing the physical surface texture/relief/sheen of the material itself (embossing, 3D texture, glossy highlights, fabric weave) rather than the overall pattern layout at normal viewing distance.
- "group_shot": multiple distinct products or colourways shown together in one photo (e.g. folded/rolled samples stacked together, or several swatches arranged side by side) — no single product is cleanly isolated.
- "noise": anything else — cover art, brand logos, decorative graphics, blank/divider content, stock photography unrelated to a specific product, or anything with no real usable product information.

For EACH photo also report:
- finishGuess: your best guess at the surface finish visible (e.g. "embossed", "glossy", "matte", "textured", "metallic", "smooth") — ONLY if role is "clean_tile" or "texture_closeup" AND you can genuinely tell from the image; null otherwise. Never guess if you are not confident.
- colorHint: a short plain-English dominant colour description (e.g. "warm beige", "dusty blue") if clearly visible; null if ambiguous or role is "noise".
- confidence: your confidence in the role classification, 0 to 1.

Respond with ONLY a JSON array of exactly `;

const PROMPT_FOOTER = ` objects, in the SAME ORDER as the photos were given, no other text:
[{ "role": "clean_tile" | "lifestyle" | "texture_closeup" | "group_shot" | "noise", "finishGuess": string | null, "colorHint": string | null, "confidence": number }, ...]`;

function isValidClassification(x: unknown): x is ImageClassification {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (!VALID_ROLES.includes(o.role as ImageRole)) return false;
  if (o.finishGuess !== null && typeof o.finishGuess !== "string") return false;
  if (o.colorHint !== null && typeof o.colorHint !== "string") return false;
  if (o.confidence !== null && typeof o.confidence !== "number") return false;
  return true;
}

async function classifyBatch(
  images: { png: Buffer }[],
  userId: string
): Promise<(ImageClassification | null)[]> {
  const nullResults = images.map(() => null);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") return nullResults;

  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];
  images.forEach((img, i) => {
    parts.push({ text: `Photo ${i + 1}:` });
    parts.push({ inline_data: { mime_type: "image/png", data: img.png.toString("base64") } });
  });
  parts.push({ text: PROMPT_HEADER + images.length + PROMPT_FOOTER });

  const t0 = Date.now();
  const requestBytes = images.reduce((sum, img) => sum + img.png.length, 0);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      }
    );
    const durationMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      void recordAiUsage({
        provider: "gemini",
        model: MODEL_ID,
        feature: "hm_catalogue_pdf_classify",
        durationMs,
        requestBytes,
        imageInputs: images.length,
        userId,
        status: "error",
        errorMessage: `HTTP ${res.status}: ${errText.slice(0, 300)}`,
      });
      return nullResults;
    }

    const data = await res.json();
    const usageMeta = data.usageMetadata;
    const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_catalogue_pdf_classify",
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs,
      requestBytes,
      imageInputs: images.length,
      userId,
      status: "success",
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return nullResults;
    }
    if (!Array.isArray(parsed) || parsed.length !== images.length) return nullResults;

    return parsed.map((item) => (isValidClassification(item) ? item : null));
  } catch (err) {
    void recordAiUsage({
      provider: "gemini",
      model: MODEL_ID,
      feature: "hm_catalogue_pdf_classify",
      durationMs: Date.now() - t0,
      requestBytes,
      imageInputs: images.length,
      userId,
      status: "error",
      errorMessage: `fetch failed: ${String(err)}`,
    });
    return nullResults;
  }
}

/**
 * Classifies a page's worth of candidate images, chunked to
 * MAX_IMAGES_PER_CALL per request. Returns one entry per input image, in
 * order; null means "not classified" (API not configured, call failed, or
 * response couldn't be trusted) — callers treat null exactly like a
 * pending/unreviewed candidate, never as "noise" by default.
 */
export async function classifyPageImages(
  pngs: Buffer[],
  userId: string
): Promise<(ImageClassification | null)[]> {
  if (pngs.length === 0) return [];
  const results: (ImageClassification | null)[] = [];
  for (let i = 0; i < pngs.length; i += MAX_IMAGES_PER_CALL) {
    const chunk = pngs.slice(i, i + MAX_IMAGES_PER_CALL).map((png) => ({ png }));
    const chunkResults = await classifyBatch(chunk, userId);
    results.push(...chunkResults);
  }
  return results;
}

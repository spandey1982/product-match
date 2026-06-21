/**
 * Automated AI review of generated images (Phase F).
 *
 * A vision model rates a generated image against the original product on a 1–5
 * rubric and writes the scores onto its GenerationRecord. Designed to be cheap
 * and safe:
 *   • Opt-in via ENABLE_AI_REVIEW; sampled via AI_REVIEW_SAMPLE_RATE (0–1).
 *   • Fire-and-forget — never blocks or breaks generation.
 *   • Only the generated BASE shots (front/back) are reviewed; close-ups are
 *     crops of an already-reviewed base, so reviewing them would be redundant
 *     and double the cost.
 *
 * Scores feed performance analytics and, eventually, data-driven catalogue
 * routing. Manual review (Phase G) writes to separate columns on the same row.
 */
import { db } from "@/lib/db";

const REVIEW_MODEL = "gemini-2.5-flash-lite";

/** Base shots are the only generated images worth scoring (crops inherit). */
const REVIEWABLE_VIEWS = new Set(["front", "back", "on-model"]);

export function isAiReviewEnabled(): boolean {
  return process.env.ENABLE_AI_REVIEW === "true";
}

function sampleRate(): number {
  const r = parseFloat(process.env.AI_REVIEW_SAMPLE_RATE ?? "1");
  return Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 1;
}

const RUBRIC = `You are a strict fashion e-commerce QA reviewer. Image 1 is an AI-GENERATED model photo. Image 2 is the ORIGINAL product. Rate Image 1 from 1 (poor) to 5 (excellent). Return raw JSON only, no markdown:
{"authenticity":0,"realism":0,"garmentPreservation":0,"drapeQuality":0,"patternPreservation":0,"renderingQuality":0,"overall":0}
- authenticity: looks like a real photograph, not obviously AI-generated
- realism: natural body, pose and lighting; no artifacts or extra/missing limbs
- garmentPreservation: the garment matches the product in shape, cut and colour
- drapeQuality: the fabric falls and drapes naturally and correctly
- patternPreservation: the print/pattern/motif is preserved faithfully
- renderingQuality: sharp, high-resolution, undistorted
- overall: holistic quality 1–5`;

async function fetchImageBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { data, mime };
  } catch {
    return null;
  }
}

interface RawScores {
  authenticity?: unknown;
  realism?: unknown;
  garmentPreservation?: unknown;
  drapeQuality?: unknown;
  patternPreservation?: unknown;
  renderingQuality?: unknown;
  overall?: unknown;
}

/** Clamp a raw score to [0,5] or null when not a finite number. */
function score(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : null;
}

/** Review one generated image and store the scores on its record. Non-fatal. */
export async function reviewAndStore(
  recordId: string,
  outputUrl: string,
  productImageUrl: string | null
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") return;

  try {
    const output = await fetchImageBase64(outputUrl);
    if (!output) return;
    const product = productImageUrl ? await fetchImageBase64(productImageUrl) : null;

    const parts: Array<Record<string, unknown>> = [
      { inline_data: { mime_type: output.mime, data: output.data } },
    ];
    if (product) {
      parts.push({ inline_data: { mime_type: product.mime, data: product.data } });
    }
    parts.push({ text: RUBRIC });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${REVIEW_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );
    if (!res.ok) return;

    const data = await res.json();
    const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    if (!json) return;

    const s = JSON.parse(json) as RawScores;

    await db.generationRecord.update({
      where: { id: recordId },
      data: {
        aiAuthenticity: score(s.authenticity),
        aiRealism: score(s.realism),
        aiGarmentPreservation: score(s.garmentPreservation),
        aiDrapeQuality: score(s.drapeQuality),
        aiPatternPreservation: score(s.patternPreservation),
        aiRenderingQuality: score(s.renderingQuality),
        aiOverall: score(s.overall),
        aiReviewModel: REVIEW_MODEL,
        aiReviewedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[ai-review] failed:", err);
  }
}

/**
 * Fire-and-forget review for a batch of just-recorded generations. Respects the
 * feature flag + sample rate and skips derived close-ups. Returns immediately;
 * reviews run in the background.
 */
export function maybeReviewGenerations(
  records: Array<{ id: string; outputUrl: string; view: string }>,
  opts: { productImageUrl?: string | null } = {}
): void {
  if (!isAiReviewEnabled()) return;
  const rate = sampleRate();
  if (rate <= 0) return;

  for (const r of records) {
    if (!REVIEWABLE_VIEWS.has(r.view)) continue;
    if (Math.random() > rate) continue;
    void reviewAndStore(r.id, r.outputUrl, opts.productImageUrl ?? null);
  }
}

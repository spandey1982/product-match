/**
 * Hierarchical Garment Intelligence analysis (R&D — Gemini Vision only).
 *
 * Two-pass design, mirroring how a merchandiser studies a garment:
 *
 *   Pass 1 (whole image): structured overview — construction, pattern,
 *     texture, surface techniques, craftsmanship — PLUS up to
 *     MAX_REGIONS regions of interest (normalized bounding boxes) where
 *     surface work deserves close-up inspection.
 *
 *   Pass 2 (one batched call): every ROI is cropped LOCALLY from the
 *     original full-resolution buffer with sharp — crops keep native pixel
 *     density that whole-image downscaling destroys, which is exactly where
 *     stitch-level information lives — and all crops go to Gemini in a
 *     single request for per-region observations.
 *
 * Cost shape: exactly 1 vision call for plain garments (no ROIs), 2 for
 * embellished ones — never N calls for N regions. Non-fatal everywhere: any
 * failure returns whatever survives (pass-2 failure keeps the pass-1 result;
 * pass-1 failure returns null) so generation always proceeds.
 */
import sharp from "sharp";
import { recordAiUsage } from "@/lib/ai-usage/record";
import type {
  BackIntelligence,
  GarmentIntelligence,
  RegionObservation,
  RegionOfInterest,
  SurfaceTechnique,
} from "./types";

/** Vision model — env-overridable so provider benchmarking never edits code. */
export const GARMENT_INTELLIGENCE_MODEL =
  process.env.GARMENT_INTELLIGENCE_MODEL || "gemini-2.5-flash";

const MAX_REGIONS = 4;
/** Whole-image analysis input cap (longest edge, px). */
const OVERVIEW_MAX_PX = 1024;
/** Per-crop input cap (longest edge, px). */
const CROP_MAX_PX = 768;

export interface AnalyzeGarmentInput {
  /** Original product image — full resolution, BEFORE any input cap. */
  buffer: Buffer;
  mime: string;
  /** Retailer-confirmed category — asserted, never reclassified. */
  category: string;
  /**
   * Retailer-uploaded detail close-ups (pallu/border/yoke/…) — the BEST
   * close-up evidence available: real macro photos with native pixel density
   * a crop of the main image can never match. When present they take the
   * pass-2 evidence slots first; model-proposed ROI crops only fill what
   * remains. Adds input tokens, never extra calls.
   */
  partImages?: Array<{ buffer: Buffer; mime: string; label: string }>;
  /** Cost attribution. */
  productId?: string | null;
  storeId?: string | null;
  userId?: string | null;
}

interface GeminiCallResult {
  text: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** One generateContent call with images + prompt, JSON response, usage recorded. */
async function callGeminiVision(
  images: Array<{ mime: string; data: Buffer }>,
  prompt: string,
  operation: string,
  ctx: AnalyzeGarmentInput
): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    return { text: null, inputTokens: null, outputTokens: null };
  }

  const t0 = Date.now();
  const usageBase = {
    provider: "gemini",
    model: GARMENT_INTELLIGENCE_MODEL,
    feature: "garment_intelligence",
    operation,
    requestBytes: images.reduce((n, i) => n + i.data.length, 0),
    imageInputs: images.length,
    storeId: ctx.storeId ?? null,
    userId: ctx.userId ?? null,
    productId: ctx.productId ?? null,
  } as const;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GARMENT_INTELLIGENCE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...images.map((i) => ({
                  inline_data: { mime_type: i.mime, data: i.data.toString("base64") },
                })),
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) {
      void recordAiUsage({ ...usageBase, durationMs: Date.now() - t0, status: "error", errorMessage: `HTTP ${res.status}` });
      return { text: null, inputTokens: null, outputTokens: null };
    }

    const data = await res.json();
    const usageMeta = data.usageMetadata;
    void recordAiUsage({
      ...usageBase,
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
      totalTokens: usageMeta?.totalTokenCount ?? null,
      durationMs: Date.now() - t0,
      status: "success",
    });

    const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    return {
      text: text || null,
      inputTokens: usageMeta?.promptTokenCount ?? null,
      outputTokens: usageMeta?.candidatesTokenCount ?? null,
    };
  } catch (err) {
    console.error(`[garment-intelligence] ${operation} call failed:`, err);
    return { text: null, inputTokens: null, outputTokens: null };
  }
}

/** Parse model JSON output defensively (handles stray markdown fences). */
function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 8) : [];

function overviewPrompt(category: string): string {
  return `You are a senior fashion merchandiser analyzing a ${category} (Indian ethnic fashion) for catalogue reproduction. This product IS a ${category} — never reclassify it.
Study the garment and return JSON with EXACTLY this shape:
{
 "construction": {"silhouette": "", "length": "", "neckline": "", "sleeves": "", "details": []},
 "surfaceTechniques": [{"type": "", "relief": "flat|low|raised|layered", "density": "sparse|scattered|medium|dense|all-over", "handcrafted": true, "colors": [], "placement": "", "stitchCharacteristics": ""}],
 "pattern": {"motifs": [], "layout": "", "scale": ""},
 "texture": {"baseFabric": "", "finish": "", "drape": ""},
 "craftsmanship": {"overallDensity": "", "handcrafted": true, "highlights": []},
 "regionsOfInterest": [{"label": "", "reason": "", "x": 0, "y": 0, "width": 0, "height": 0}],
 "confidence": "high|medium|low"
}
Rules:
- construction.length: the garment's PRECISE hem level in body-landmark terms — "hip-length", "mid-thigh", "knee-length", "mid-shin", "ankle-length"... There is no universal ${category} length; state exactly where THIS one ends. construction.sleeves: the PRECISE sleeve length — "sleeveless", "cap sleeves", "half sleeves", "elbow-length", "three-quarter sleeves", "full sleeves". Both are mandatory whenever the garment has a hem/sleeves; a wrong guess here ruins the generated image.
- surfaceTechniques: name the SPECIFIC technique (chikankari, zari, mirror work, sequins, bead work, applique, lace, crochet, jacquard, quilting, smocking, block print, digital print...) — never just "embroidery" if a more precise name applies. Distinguish printed/flat work from dimensional stitched work; "relief" and "handcrafted" must reflect the physical surface, not the visual pattern.
- craftsmanship.highlights: the 2-4 things a generated catalogue image must NOT lose.
- regionsOfInterest: up to ${MAX_REGIONS} regions where surface work/craftsmanship is best visible and deserves close-up analysis (x,y,width,height normalized 0..1 on this image, garment areas only — skip faces/background). Empty array if the garment is plain.
- Report only what is clearly visible. Unknown fields: empty string/array.`;
}

function backPrompt(category: string): string {
  return `This is the BACK view photo of the same ${category} (Indian ethnic fashion). Describe ONLY what is visible in THIS back photo — never assume the front design repeats on the back.
Return JSON with EXACTLY this shape:
{"plain": false, "design": "", "techniques": [], "neckline": ""}
Rules:
- "plain": true when the back is essentially unadorned fabric.
- "design": what is actually on the back — e.g. "plain solid fabric", "continues the all-over butti pattern", "embroidered back yoke with plain body".
- "techniques": specific surface techniques visible on the back (often fewer than the front; empty when plain).
- "neckline": the back neckline shape/detail.`;
}

/** One close-up evidence image for pass 2 — a retailer macro photo or an ROI crop. */
interface EvidenceImage {
  label: string;
  /** How the image was obtained — phrased into the prompt for context. */
  provenance: string;
  mime: string;
  data: Buffer;
}

function regionPrompt(category: string, evidence: EvidenceImage[]): string {
  const list = evidence.map((e, i) => `Image ${i + 1}: "${e.label}" — ${e.provenance}`).join("\n");
  return `These are close-up views of the SAME ${category} you would analyze as a fashion merchandiser. For each image, describe the surface work at stitch level.
${list}
Return JSON: an array with EXACTLY one object per image, in order:
[{"label": "", "technique": "", "relief": "flat|low|raised|layered", "detail": "", "motif": ""}]
Rules:
- "detail": the stitch/work characteristics visible at THIS scale — thread thickness, stitch length and separation, knots, layering, shadows cast by raised threads, irregularity that signals handwork. Be concrete and physical ("individually visible 2-3mm running stitches sitting proud of the fabric"), never generic ("nice embroidery").
- "motif": the geometric structure inside the image (lattice, boxes, flower centers, arcs...).
- If an image shows printed/flat work, say so plainly — relief "flat", detail describing the printed appearance.`;
}

/** Clamp an ROI to sane normalized bounds; null when degenerate. */
function clampRegion(r: unknown): RegionOfInterest | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  let x = num(o.x), y = num(o.y), w = num(o.width), h = num(o.height);
  if ([x, y, w, h].some(Number.isNaN)) return null;
  x = Math.min(Math.max(x, 0), 0.98);
  y = Math.min(Math.max(y, 0), 0.98);
  w = Math.min(Math.max(w, 0.02), 1 - x);
  h = Math.min(Math.max(h, 0.02), 1 - y);
  // Reject slivers — a crop under ~5% of the image carries no usable detail.
  if (w < 0.05 || h < 0.05) return null;
  const label = str(o.label) || "detail region";
  return { label, reason: str(o.reason), x, y, width: w, height: h };
}

function normalizeTechnique(t: unknown): SurfaceTechnique | null {
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  const type = str(o.type);
  if (!type) return null;
  return {
    type,
    relief: str(o.relief) || "flat",
    density: str(o.density) || "medium",
    handcrafted: o.handcrafted === true,
    colors: strArr(o.colors),
    placement: str(o.placement),
    stitchCharacteristics: str(o.stitchCharacteristics),
  };
}

interface OverviewPayload {
  construction?: Record<string, unknown>;
  surfaceTechniques?: unknown[];
  pattern?: Record<string, unknown>;
  texture?: Record<string, unknown>;
  craftsmanship?: Record<string, unknown>;
  regionsOfInterest?: unknown[];
  confidence?: unknown;
}

/**
 * Run the full hierarchical analysis. Returns null only when the overview
 * pass fails entirely (no key, fetch failure, unparseable output).
 */
export async function analyzeGarment(
  input: AnalyzeGarmentInput
): Promise<GarmentIntelligence | null> {
  // ── Pass 1: whole-image overview + ROI proposal ─────────────────────────
  const overviewImage = await sharp(input.buffer)
    .rotate()
    .resize({ width: OVERVIEW_MAX_PX, height: OVERVIEW_MAX_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();

  const overviewRes = await callGeminiVision(
    [{ mime: "image/jpeg", data: overviewImage }],
    overviewPrompt(input.category),
    "overview",
    input
  );
  const overview = parseJson<OverviewPayload>(overviewRes.text);
  if (!overview) return null;

  const construction = overview.construction ?? {};
  const pattern = overview.pattern ?? {};
  const texture = overview.texture ?? {};
  const craftsmanship = overview.craftsmanship ?? {};

  const intelligence: GarmentIntelligence = {
    version: 2,
    construction: {
      silhouette: str(construction.silhouette),
      length: str(construction.length),
      neckline: str(construction.neckline),
      sleeves: str(construction.sleeves),
      details: strArr(construction.details),
    },
    surfaceTechniques: (overview.surfaceTechniques ?? [])
      .map(normalizeTechnique)
      .filter((t): t is SurfaceTechnique => t !== null)
      .slice(0, 6),
    pattern: {
      motifs: strArr(pattern.motifs),
      layout: str(pattern.layout),
      scale: str(pattern.scale),
    },
    texture: {
      baseFabric: str(texture.baseFabric),
      finish: str(texture.finish),
      drape: str(texture.drape),
    },
    craftsmanship: {
      overallDensity: str(craftsmanship.overallDensity),
      handcrafted: craftsmanship.handcrafted === true,
      highlights: strArr(craftsmanship.highlights),
    },
    regions: [],
    back: null,
    confidence: str(overview.confidence) || "medium",
  };

  // ── Pass 2: close-up evidence, one batched call ─────────────────────────
  // Retailer part close-ups first (real macro photos — the best evidence);
  // model-proposed ROI crops of the original buffer fill the remaining slots.
  try {
    const evidence: EvidenceImage[] = [];

    for (const part of (input.partImages ?? []).slice(0, MAX_REGIONS)) {
      try {
        const resized = await sharp(part.buffer)
          .rotate()
          .resize({ width: CROP_MAX_PX, height: CROP_MAX_PX, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();
        evidence.push({
          label: part.label || "detail close-up",
          provenance: "a real close-up photo of this area uploaded by the retailer",
          mime: "image/jpeg",
          data: resized,
        });
      } catch {
        /* skip a bad part image; the rest still run */
      }
    }

    const regions = (overview.regionsOfInterest ?? [])
      .map(clampRegion)
      .filter((r): r is RegionOfInterest => r !== null)
      .slice(0, Math.max(0, MAX_REGIONS - evidence.length));

    if (regions.length > 0) {
      const meta = await sharp(input.buffer).rotate().metadata();
      const W = meta.width ?? 0;
      const H = meta.height ?? 0;
      if (W > 0 && H > 0) {
        for (const r of regions) {
          try {
            const crop = await sharp(input.buffer)
              .rotate()
              .extract({
                left: Math.round(r.x * W),
                top: Math.round(r.y * H),
                width: Math.max(16, Math.round(r.width * W)),
                height: Math.max(16, Math.round(r.height * H)),
              })
              .resize({ width: CROP_MAX_PX, height: CROP_MAX_PX, fit: "inside", withoutEnlargement: true })
              .jpeg({ quality: 90 })
              .toBuffer();
            evidence.push({
              label: r.label,
              provenance: `a crop of the main photo — ${r.reason || "flagged for close-up analysis"}`,
              mime: "image/jpeg",
              data: crop,
            });
          } catch {
            /* skip a bad crop; the rest still run */
          }
        }
      }
    }

    if (evidence.length > 0) {
      const regionRes = await callGeminiVision(
        evidence.map((e) => ({ mime: e.mime, data: e.data })),
        regionPrompt(input.category, evidence),
        "regions",
        input
      );
      const observations = parseJson<unknown[]>(regionRes.text);
      if (Array.isArray(observations)) {
        intelligence.regions = observations
          .slice(0, evidence.length)
          .map((obs, i): RegionObservation | null => {
            if (!obs || typeof obs !== "object") return null;
            const o = obs as Record<string, unknown>;
            return {
              label: str(o.label) || evidence[i].label,
              technique: str(o.technique),
              relief: str(o.relief),
              detail: str(o.detail),
              motif: str(o.motif),
            };
          })
          .filter((o): o is RegionObservation => o !== null);
      }
    }
  } catch (err) {
    // Pass-2 failure is non-fatal: keep the pass-1 intelligence.
    console.error("[garment-intelligence] region pass failed:", err);
  }

  return intelligence;
}

/**
 * Analyze the BACK image (one call, no region pass — backs are usually far
 * simpler than fronts). Null on any failure; callers fall back to the
 * deterministic back guard clause in the prompt builder.
 */
export async function analyzeGarmentBack(
  input: AnalyzeGarmentInput
): Promise<BackIntelligence | null> {
  const backImage = await sharp(input.buffer)
    .rotate()
    .resize({ width: OVERVIEW_MAX_PX, height: OVERVIEW_MAX_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();

  const res = await callGeminiVision(
    [{ mime: "image/jpeg", data: backImage }],
    backPrompt(input.category),
    "back",
    input
  );
  const parsed = parseJson<Record<string, unknown>>(res.text);
  if (!parsed) return null;

  return {
    plain: parsed.plain === true,
    design: str(parsed.design),
    techniques: strArr(parsed.techniques),
    neckline: str(parsed.neckline),
  };
}

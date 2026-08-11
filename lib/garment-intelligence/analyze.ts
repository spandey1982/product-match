/**
 * Hierarchical Garment Intelligence analysis (R&D — Gemini Vision only).
 *
 * Two-pass design, mirroring how a merchandiser studies a garment:
 *
 *   Pass 1 (whole image): structured overview — construction, pattern,
 *     texture, surface techniques, craftsmanship — PLUS up to
 *     maxRegionsFor(category) regions of interest (normalized bounding
 *     boxes) where surface work deserves close-up inspection.
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
  ButiPopulation,
  GarmentIntelligence,
  RegionObservation,
  RegionOfInterest,
  SareeBorder,
  SareeBorderSubBand,
  SareeColorZone,
  SareeStructure,
  SurfaceTechnique,
} from "./types";

/** Vision model — env-overridable so provider benchmarking never edits code. */
export const GARMENT_INTELLIGENCE_MODEL =
  process.env.GARMENT_INTELLIGENCE_MODEL || "gemini-2.5-flash";

/**
 * Saree/dupatta structurally has more independent zones than a generic
 * garment (2 independent borders + pallu + potentially several buti
 * populations) — a flat region budget assumed for a plain kurta undersells
 * it. Same call shape either way (batched pass-2 call doesn't scale with
 * region count), just a larger per-call token budget for this category.
 */
function isSareeLike(category: string): boolean {
  const c = category.trim().toLowerCase();
  return c === "saree" || c === "dupatta";
}

function maxRegionsFor(category: string): number {
  return isSareeLike(category) ? 6 : 4;
}

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

/**
 * Saree/dupatta anatomy vocabulary, injected only for those categories so
 * every other category's prompt stays byte-identical to before. Translates
 * the verified rules (see PROJECT_KNOWLEDGE.md, "Saree/dupatta anatomy
 * vocabulary") directly into extraction instructions rather than leaving the
 * model to rediscover them per product.
 */
function sareeVocabularyBlock(): string {
  return `
Saree-specific anatomy — report this as "sareeStructure":
- GEOMETRIC BORDER RULE (never guess from photo framing): a saree's border runs along its two LONG edges (the full length); the pallu is the SHORT edge at one end. To tell top from bottom: stand at the pallu edge, face into the body of the saree, fabric right-side-up — the border on your right hand is the TOP border, on your left is the BOTTOM border. The bottom border is the one nearest the wearer's feet and anchors the front pleats. Apply this rule; do not infer top/bottom from which side of the photo a border happens to appear on. If the photo genuinely doesn't show enough to apply the rule, use edge "unspecified" rather than guessing.
- Describe the TOP and BOTTOM borders INDEPENDENTLY — they are frequently different in design AND width, never assume symmetry. Each border may itself be a STACK of distinct sub-bands (e.g. a wide motif panel plus a narrower stone trim plus an edge finish) — list each sub-band in order, outer edge first, rather than collapsing the border into one description.
- Classify how the pallu relates to the border: "same-rotated" (same design, turned 90° at the corner), "boxed-nested" (the border continues as a frame around the pallu, which carries its own distinct interior content), "independent" (unrelated designs), or "unknown". When boxed-nested, describe the pallu's interior content SEPARATELY from the continuing border-frame. Note the corner treatment briefly (low priority, but real). Note tassel/fringe placement precisely (pallu end only? along a border? — never assume it's universal).
- Enumerate ALL distinct buti (body motif) populations — sarees frequently carry MORE THAN ONE, not just a single repeated motif. For each: its placement zone (e.g. "all-over body", "confined to the bottom border only", "one color zone only" — this is also where a motif that bridges two zones, like a border band merging into a buti band, gets described in free text rather than forced into one category), whether it is "discrete" (a small self-contained repeat unit) or "continuous" (a connected/flowing pattern like a trailing vine with no single repeatable unit — mark this clearly, since a continuous population must never be treated as a stamped motif), and its running axis relative to the pallu: "perpendicular" (spans border-to-border across the width), "parallel" (runs along the length, hugging one specific border), or "none" (radially symmetric or non-directional, no orientation signal).
- Classify the color structure: is the base a single solid color, a gradient, or a HARD LINE split (the whole width changes together at one point along the length — distinct from a gradient)? If hard-split, describe each color zone and whether that zone's border or buti design differs from the saree's default (many hard-split sarees carry two semi-independent decorative systems, not just two colors of the same design). If a sheer/see-through fabric makes one zone's motif appear to show through onto an adjacent zone, report that as an ABSENCE on the zone it shows through onto (it belongs to its true source zone), not as real content there.`;
}

function overviewPrompt(category: string): string {
  const saree = isSareeLike(category);
  const maxRegions = maxRegionsFor(category);
  const surfaceTechniqueShape =
    `{"type": "", "relief": "flat|low|raised|layered", "density": "sparse|scattered|medium|dense|all-over", "handcrafted": true, "colors": [], "placement": "", "stitchCharacteristics": "", ` +
    `"constructionMethod": "", "materialComposition": [], "physicallyLayered": false, "layeringNote": ""}`;
  const sareeStructureShape = saree
    ? `,
 "sareeStructure": {
   "borders": [{"edge": "top|bottom|unspecified", "design": "", "subBands": [{"order": 0, "description": "", "width": "", "technique": ""}], "edgeAddition": ""}],
   "palluRelationship": "same-rotated|boxed-nested|independent|unknown",
   "palluContent": "", "palluCornerTreatment": "", "palluTassels": "",
   "butiPopulations": [{"label": "", "placementZone": "", "patternType": "discrete|continuous", "axis": "perpendicular|parallel|none", "motif": "", "technique": "", "colors": []}],
   "colorZones": [{"label": "", "colorMechanism": "", "colors": [], "decorativeOverrideNote": ""}],
   "hardSplit": false
 }`
    : "";
  return `You are a senior fashion merchandiser analyzing a ${category} (Indian ethnic fashion) for catalogue reproduction. This product IS a ${category} — never reclassify it.
Study the garment and return JSON with EXACTLY this shape:
{
 "construction": {"silhouette": "", "length": "", "neckline": "", "sleeves": "", "details": []},
 "surfaceTechniques": [${surfaceTechniqueShape}],
 "pattern": {"motifs": [], "layout": "", "scale": ""},
 "texture": {"baseFabric": "", "finish": "", "drape": ""},
 "craftsmanship": {"overallDensity": "", "handcrafted": true, "highlights": [], "captureRisk": ""},
 "regionsOfInterest": [{"label": "", "reason": "", "x": 0, "y": 0, "width": 0, "height": 0}],
 "confidence": "high|medium|low",
 "explicitAbsences": []${sareeStructureShape}
}
Rules:
- construction.length: the garment's PRECISE hem level in body-landmark terms — "hip-length", "mid-thigh", "knee-length", "mid-shin", "ankle-length"... There is no universal ${category} length; state exactly where THIS one ends. construction.sleeves: the PRECISE sleeve length — "sleeveless", "cap sleeves", "half sleeves", "elbow-length", "three-quarter sleeves", "full sleeves". Both are mandatory whenever the garment has a hem/sleeves — when they are partially occluded or hard to see (folded garment, cropped photo), give your single most likely estimate anyway; NEVER leave them empty. An empty field lets every generated view invent its own answer, which is worse than a consistent best estimate.
- surfaceTechniques: name the SPECIFIC technique (chikankari, zari, mirror work, sequins, bead work, applique, lace, crochet, jacquard, quilting, smocking, block print, digital print...) — never just "embroidery" if a more precise name applies. Distinguish printed/flat work from dimensional stitched work; "relief" and "handcrafted" must reflect the physical surface, not the visual pattern.
- constructionMethod: state HOW the technique is physically made — "woven into the fabric structure" (jacquard/brocade — authentically lower-relief, flat is CORRECT for these) vs "applied onto the surface after weaving" (embroidery/appliqué/stitched thread/stonework — genuinely raised even when photographed under light that makes it look flat). This determines whether a flat photographic read is authentic or a fidelity loss to correct for — judge it from what the technique physically IS, not only from how this particular photo happens to light it.
- materialComposition: when a single motif/technique combines multiple distinct material classes (e.g. metallic thread petals + a stone ring + a contrast velvet centre), list each; empty when single-material.
- physicallyLayered / layeringNote: true only when techniques are physically stacked on top of each other (e.g. a zari base layer, then thread stitching over it, then mirror discs set on top of that) producing cumulative real thickness — not just one raised layer. Describe the stack order in layeringNote when true.
- craftsmanship.highlights: the 2-4 things a generated catalogue image must NOT lose. craftsmanship.captureRisk: state plainly when an embellishment's color closely matches the base fabric color — such work can be nearly invisible in a normal photo and needs to be flagged, not silently under-reported.
- explicitAbsences: list anything a viewer familiar with this garment category would reasonably expect but that is CONFIRMED ABSENT here (e.g. "no buti on the plain end of the fabric") — never leave an absence to silence; a generator with no negative signal defaults to inventing plausible detail where none exists.
- regionsOfInterest: up to ${maxRegions} regions where surface work/craftsmanship is best visible and deserves close-up analysis (x,y,width,height normalized 0..1 on this image, garment areas only — skip faces/background). Empty array if the garment is plain.
- Report only what is clearly visible. Unknown fields: empty string/array.${saree ? sareeVocabularyBlock() : ""}`;
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
  /** Which evidence lane produced this image. */
  source: "upload" | "roi";
  /** Normalized bbox on the analyzed main image; null for retailer uploads (a separate photo, no position on the main image). */
  bbox: { x: number; y: number; width: number; height: number } | null;
}

function regionPrompt(category: string, evidence: EvidenceImage[], saree: boolean): string {
  const list = evidence.map((e, i) => `Image ${i + 1}: "${e.label}" — ${e.provenance}`).join("\n");
  return `These are close-up views of the SAME ${category} you would analyze as a fashion merchandiser. For each image, describe the surface work at stitch level.
${list}
Return JSON: an array with EXACTLY one object per image, in order:
[{"label": "", "technique": "", "relief": "flat|low|raised|layered", "detail": "", "motif": "", "constructionMethod": ""}]
Rules:
- "detail": the stitch/work characteristics visible at THIS scale — thread thickness, stitch length and separation, knots, layering, shadows cast by raised threads, irregularity that signals handwork. Be concrete and physical ("individually visible 2-3mm running stitches sitting proud of the fabric"), never generic ("nice embroidery").
- "motif": the geometric structure inside the image (lattice, boxes, flower centers, arcs...).
- "constructionMethod": same vocabulary as the overview pass — "woven into the fabric structure" vs "applied onto the surface after weaving". This close-up is your best evidence for this judgment; use it even if the overview pass already guessed.
- If an image shows printed/flat work, say so plainly — relief "flat", detail describing the printed appearance.${saree ? '\n- For a saree, also state which named buti population or border sub-band (from the overview) this crop belongs to, if identifiable, folded into "detail".' : ""}`;
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
    constructionMethod: str(o.constructionMethod),
    materialComposition: strArr(o.materialComposition),
    physicallyLayered: o.physicallyLayered === true,
    layeringNote: str(o.layeringNote),
  };
}

function normalizeBorderSubBand(b: unknown): SareeBorderSubBand | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const description = str(o.description);
  if (!description) return null;
  const order = typeof o.order === "number" && Number.isFinite(o.order) ? o.order : 0;
  return { order, description, width: str(o.width), technique: str(o.technique) };
}

function normalizeBorder(b: unknown): SareeBorder | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const design = str(o.design);
  const subBands = Array.isArray(o.subBands)
    ? o.subBands.map(normalizeBorderSubBand).filter((s): s is SareeBorderSubBand => s !== null).slice(0, 5)
    : [];
  if (!design && subBands.length === 0) return null;
  const edgeRaw = str(o.edge);
  const edge: SareeBorder["edge"] =
    edgeRaw === "top" || edgeRaw === "bottom" ? edgeRaw : "unspecified";
  return { edge, design, subBands, edgeAddition: str(o.edgeAddition) };
}

function normalizeButiPopulation(b: unknown): ButiPopulation | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const motif = str(o.motif);
  const label = str(o.label);
  if (!motif && !label) return null;
  const patternType: ButiPopulation["patternType"] = o.patternType === "continuous" ? "continuous" : "discrete";
  const axisRaw = str(o.axis);
  const axis: ButiPopulation["axis"] =
    axisRaw === "perpendicular" || axisRaw === "parallel" ? axisRaw : "none";
  return {
    label: label || motif,
    placementZone: str(o.placementZone),
    patternType,
    axis,
    motif,
    technique: str(o.technique),
    colors: strArr(o.colors),
  };
}

function normalizeColorZone(z: unknown): SareeColorZone | null {
  if (!z || typeof z !== "object") return null;
  const o = z as Record<string, unknown>;
  const label = str(o.label);
  if (!label) return null;
  return {
    label,
    colorMechanism: str(o.colorMechanism),
    colors: strArr(o.colors),
    decorativeOverrideNote: str(o.decorativeOverrideNote),
  };
}

function normalizeSareeStructure(s: unknown): SareeStructure | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const borders = Array.isArray(o.borders)
    ? o.borders.map(normalizeBorder).filter((b): b is SareeBorder => b !== null).slice(0, 2)
    : [];
  const butiPopulations = Array.isArray(o.butiPopulations)
    ? o.butiPopulations.map(normalizeButiPopulation).filter((b): b is ButiPopulation => b !== null).slice(0, 6)
    : [];
  const colorZones = Array.isArray(o.colorZones)
    ? o.colorZones.map(normalizeColorZone).filter((z): z is SareeColorZone => z !== null).slice(0, 4)
    : [];
  // Nothing usable extracted — treat as no structure rather than an empty shell.
  if (borders.length === 0 && butiPopulations.length === 0 && colorZones.length === 0) return null;
  const relRaw = str(o.palluRelationship);
  const palluRelationship: SareeStructure["palluRelationship"] =
    relRaw === "same-rotated" || relRaw === "boxed-nested" || relRaw === "independent" ? relRaw : "unknown";
  return {
    borders,
    palluRelationship,
    palluContent: str(o.palluContent),
    palluCornerTreatment: str(o.palluCornerTreatment),
    palluTassels: str(o.palluTassels),
    butiPopulations,
    colorZones,
    hardSplit: o.hardSplit === true,
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
  explicitAbsences?: unknown[];
  sareeStructure?: unknown;
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

  const saree = isSareeLike(input.category);
  const maxRegions = maxRegionsFor(input.category);

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
    version: 3,
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
      captureRisk: str(craftsmanship.captureRisk),
    },
    regions: [],
    back: null,
    confidence: str(overview.confidence) || "medium",
    explicitAbsences: strArr(overview.explicitAbsences),
    sareeStructure: saree ? normalizeSareeStructure(overview.sareeStructure) : null,
  };

  // Deterministic pallu default when the model has NO signal either way
  // (palluRelationship "unknown") and the retailer didn't upload a dedicated
  // pallu close-up: default to "same-rotated" with no distinct content,
  // rather than leaving a gap the generator will fill in on its own.
  // Genuine evidence is never overridden — this only fires when the model
  // itself found nothing to go on. See PROJECT_KNOWLEDGE.md, saree anatomy
  // vocabulary section: a saree always has a border and a pallu; the open
  // question is only whether they match, and "no evidence of a difference"
  // must mean "assume they match," never "invent a difference."
  if (intelligence.sareeStructure && intelligence.sareeStructure.palluRelationship === "unknown") {
    const hasPalluEvidence = (input.partImages ?? []).some((p) => /pallu/i.test(p.label));
    if (!hasPalluEvidence) {
      intelligence.sareeStructure = {
        ...intelligence.sareeStructure,
        palluRelationship: "same-rotated",
        palluContent:
          intelligence.sareeStructure.palluContent ||
          "no separate pallu evidence provided — assume it continues the border design, rotated at the corner",
      };
    }
  }

  // ── Pass 2: close-up evidence, one batched call ─────────────────────────
  // Retailer part close-ups first (real macro photos — the best evidence);
  // model-proposed ROI crops of the original buffer fill the remaining slots.
  try {
    const evidence: EvidenceImage[] = [];

    for (const part of (input.partImages ?? []).slice(0, maxRegions)) {
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
          source: "upload",
          bbox: null,
        });
      } catch {
        /* skip a bad part image; the rest still run */
      }
    }

    const regions = (overview.regionsOfInterest ?? [])
      .map(clampRegion)
      .filter((r): r is RegionOfInterest => r !== null)
      .slice(0, Math.max(0, maxRegions - evidence.length));

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
              source: "roi",
              bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
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
        regionPrompt(input.category, evidence, saree),
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
              constructionMethod: str(o.constructionMethod),
              bbox: evidence[i].bbox,
              source: evidence[i].source,
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

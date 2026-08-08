/**
 * Phase 3 — thread Garment Intelligence's OWN evidence into generation-time
 * image conditioning (R&D, ENABLE_GI_REGION_REFERENCES).
 *
 * Today's region conditioning (lib/product/part-slots.ts GEN_REFERENCES) only
 * ever sends pixels for exactly 2 hardcoded named zones (pallu, border), and
 * only when the retailer happened to upload into those exact slots. But GI's
 * own analysis already assembles a FULLER evidence set per product — every
 * retailer part upload (source "upload") plus whatever the model's own pass-1
 * flagged as distinctive on its own (source "roi", up to maxRegionsFor) — and
 * that evidence today dead-ends at TEXT (regions[].detail). This module
 * reconnects that same evidence to the generator as real image inputs, for
 * however many distinctive zones a product actually has, not a fixed 2 (see
 * docs/research/SAREE_ANATOMY_TAXONOMY.md, "no human narrator in production").
 *
 * Text vs. image split is deliberate, not redundant: a macro crop shown alone
 * carries no information about WHERE it belongs or which way is "up" — that's
 * exactly the class of fact Sample 1's deliberately-upside-down test image
 * demonstrated a crop cannot convey on its own. So each reference here is
 * paired with an explicit placement sentence sourced from GI's STRUCTURED
 * data (ButiPopulation.placementZone/axis, SareeBorder.edge/design) — the
 * image carries surface/relief truth, the text carries the geometric fact,
 * and the text explicitly tells the model to trust the stated placement over
 * the crop's own incidental framing/rotation.
 */
import sharp from "sharp";
import { fetchProductImageBuffer } from "@/lib/generate-model-image";
import type { PartImage } from "@/lib/product/part-slots";
import type { ButiPopulation, GarmentIntelligence, RegionObservation, SareeBorder } from "./types";

/** Per-crop input cap — matches analyze.ts's CROP_MAX_PX so generation sees the same pixel density GI's own analysis did. */
const CROP_MAX_PX = 768;

/** Total GI-sourced references added on top of any named-slot (pallu/border) refs — cost control. */
export const GI_REGION_EVIDENCE_LIMIT = 3;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Best-effort match of a region observation back to the structured buti
 * population it belongs to — relies on Phase 1's regionPrompt already asking
 * each close-up to name which population/sub-band it's evidence for (folded
 * into `detail`). Approximate substring/keyword overlap, not exact; accepted
 * per "avoid overbuilding" — a missed match just falls back to generic
 * placement text, not a wrong one.
 */
function matchButiPopulation(region: RegionObservation, populations: ButiPopulation[]): ButiPopulation | null {
  const haystack = norm(`${region.label} ${region.motif} ${region.detail}`);
  for (const p of populations) {
    const label = norm(p.label);
    if (label && haystack.includes(label)) return p;
  }
  for (const p of populations) {
    const zoneWords = norm(p.placementZone).split(/\W+/).filter((w) => w.length > 4);
    if (zoneWords.some((w) => haystack.includes(w))) return p;
  }
  return null;
}

/** Same approximate-match philosophy as matchButiPopulation, for borders. */
function matchBorder(region: RegionObservation, borders: SareeBorder[]): SareeBorder | null {
  const haystack = norm(`${region.label} ${region.detail}`);
  if (!haystack.includes("border")) return null;
  const named = borders.find((b) => b.edge !== "unspecified" && haystack.includes(`${b.edge} border`));
  if (named) return named;
  // Exactly one usable border and the crop is clearly border-related — safer
  // than guessing between two when the text doesn't say which.
  const candidates = borders.filter((b) => b.edge !== "unspecified");
  return candidates.length === 1 ? candidates[0] : null;
}

function axisPhrase(axis: ButiPopulation["axis"]): string {
  if (axis === "perpendicular") return "running perpendicular to the pallu, spanning border-to-border across the width";
  if (axis === "parallel") return "running parallel to the pallu, along the length, hugging one specific border only";
  return "with no directional axis — place it per the zone stated here, not by rotating this crop";
}

function butiPlacementText(p: ButiPopulation): string {
  const continuousNote =
    p.patternType === "continuous"
      ? " This is a CONTINUOUS/connected pattern, not a repeatable stamped unit — never treat this crop as one motif to tile; layout authority stays with the main product image."
      : "";
  return (
    `This is the "${p.label}" buti population — ${p.placementZone || "placement per the product's structure"}, ` +
    `${axisPhrase(p.axis)}.${continuousNote} Do not infer this population's position from this crop's own framing ` +
    `or rotation — trust this placement statement instead.`
  );
}

function borderPlacementText(b: SareeBorder): string {
  const edgeWord = b.edge === "unspecified" ? "one of the saree's two borders" : `the ${b.edge} border`;
  return (
    `This is ${edgeWord}${b.design ? ` — ${b.design}` : ""}. Trust the saree's stated border/pallu geometry ` +
    `for exact placement, not this crop's own orientation.`
  );
}

function genericPlacementText(region: RegionObservation): string {
  const bits = [region.motif, region.detail].filter(Boolean).join(" — ");
  return (
    `This close-up shows: ${bits || region.label || "a detail region"}. Trust the broader product image for ` +
    `exact placement — do not infer position from this crop's own framing or rotation.`
  );
}

export interface GIRegionReference {
  buffer: Buffer;
  mime: string;
  placement: string;
}

/**
 * Build generation-time image references from GI's own evidence — retailer
 * part uploads re-fetched by URL, model-proposed ROI crops re-derived from
 * the stored main image via their persisted bbox. Skips any region whose
 * label closely overlaps an already-included named reference (approximate
 * dedupe — avoids sending the pallu twice if GI's own ROI also flagged it).
 */
export async function giRegionReferences(
  gi: GarmentIntelligence,
  sourceBuffer: Buffer,
  partImages: PartImage[],
  alreadyUsedLabels: string[],
  limit: number = GI_REGION_EVIDENCE_LIMIT
): Promise<GIRegionReference[]> {
  const out: GIRegionReference[] = [];
  const used = alreadyUsedLabels.map(norm).filter(Boolean);
  const populations = gi.sareeStructure?.butiPopulations ?? [];
  const borders = gi.sareeStructure?.borders ?? [];

  let dims: { width: number; height: number } | null = null;

  for (const region of gi.regions) {
    if (out.length >= limit) break;

    const labelNorm = norm(region.label);
    if (used.some((u) => labelNorm.includes(u) || u.includes(labelNorm))) continue;

    let buffer: Buffer | null = null;
    let mime = "image/jpeg";

    if (region.source === "upload") {
      const part = partImages.find((p) => norm(p.label || p.slot) === labelNorm);
      if (!part) continue;
      const fetched = await fetchProductImageBuffer(part.url);
      if (!fetched) continue;
      buffer = fetched.buffer;
      mime = fetched.mime;
    } else if (region.source === "roi" && region.bbox) {
      try {
        if (!dims) {
          const meta = await sharp(sourceBuffer).rotate().metadata();
          dims = { width: meta.width ?? 0, height: meta.height ?? 0 };
        }
        if (dims.width <= 0 || dims.height <= 0) continue;
        buffer = await sharp(sourceBuffer)
          .rotate()
          .extract({
            left: Math.round(region.bbox.x * dims.width),
            top: Math.round(region.bbox.y * dims.height),
            width: Math.max(16, Math.round(region.bbox.width * dims.width)),
            height: Math.max(16, Math.round(region.bbox.height * dims.height)),
          })
          .resize({ width: CROP_MAX_PX, height: CROP_MAX_PX, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();
      } catch {
        continue;
      }
    } else {
      continue;
    }

    const population = matchButiPopulation(region, populations);
    const border = !population ? matchBorder(region, borders) : null;
    const placement = population
      ? butiPlacementText(population)
      : border
        ? borderPlacementText(border)
        : genericPlacementText(region);

    out.push({ buffer, mime, placement });
  }

  return out;
}

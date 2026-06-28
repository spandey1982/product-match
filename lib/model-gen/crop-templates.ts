/**
 * Crop-template system for catalogue close-ups.
 *
 * Catalogue generation produces a small number of *base* model shots (Front
 * Full, Back Full) via the provider, then derives category-specific close-ups
 * by cropping configured regions of those base shots — NOT blind cropping.
 * Each region is a relative box (fractions of the base image), rendered by
 * Cloudinary's `c_crop`, so close-ups are cheap (no extra generation),
 * deterministic, and consistent.
 *
 * Designed for extensibility: add a category or tweak a region in one place.
 * A future per-region `mode: "crop" | "generate"` could opt specific close-ups
 * into a dedicated generation call without changing callers.
 */

/** Relative crop box — fractions (0–1) of the base image, from the top-left. */
export interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CloseUp {
  /** Stored on ProductImage.view (e.g. "front-top"). */
  id: string;
  /** Retailer-facing label. */
  label: string;
  /** Which base shot this is cropped from. */
  from: "front" | "back";
  region: CropRegion;
}

// ── Category close-up sets ────────────────────────────────────────────────────
// Close-ups are cropped from the base shots; the master delivery variant then
// upscales+sharpens the crop, so each close-up is rendered at high resolution.

// Saree → Front Full, Back Full, Blouse, Pallu, Pleats (5 total)
const SAREE: CloseUp[] = [
  { id: "blouse", label: "Blouse Close-Up", from: "front", region: { x: 0.20, y: 0.06, w: 0.60, h: 0.30 } },
  // Pallu = the spread drape, visible on the BACK shot (over the shoulder down
  // to where the drape ends), not the front. Left portion of the back base.
  { id: "pallu",  label: "Pallu Close-Up",  from: "back",  region: { x: 0.0, y: 0.18, w: 0.55, h: 0.77 } },
  { id: "pleats", label: "Pleats Close-Up", from: "front", region: { x: 0.24, y: 0.50, w: 0.52, h: 0.46 } },
];

// Lehenga → Front Full, Back Full, Blouse, Lehenga Detail (4 total)
const LEHENGA: CloseUp[] = [
  { id: "blouse",         label: "Blouse Close-Up",         from: "front", region: { x: 0.20, y: 0.05, w: 0.60, h: 0.32 } },
  { id: "lehenga-detail", label: "Lehenga Detail Close-Up", from: "front", region: { x: 0.08, y: 0.50, w: 0.84, h: 0.48 } },
];

// Kurti / T-Shirt / Shirt / Trouser / Leggings / similar → Front, Back, Design (3 total)
const DETAIL: CloseUp[] = [
  { id: "design", label: "Design Close-Up", from: "front", region: { x: 0.22, y: 0.16, w: 0.56, h: 0.40 } },
];

// Kurti / Kurta → the salwar/pyjama shows on the lower body of the FRONT base.
const KURTI: CloseUp[] = [
  { id: "salwar", label: "Salwar Close-Up", from: "front", region: { x: 0.30, y: 0.62, w: 0.40, h: 0.36 } },
];

const CATEGORY_CLOSEUPS: Record<string, CloseUp[]> = {
  saree: SAREE,
  dupatta: SAREE,
  lehenga: LEHENGA,
  sharara: LEHENGA,
  kurta: KURTI,
  kurti: KURTI,
  // shirt/trouser/leggings/t-shirt/etc. → DETAIL (default)
};

/** The default close-up set for categories without a specific template. */
export const DEFAULT_CLOSEUPS: CloseUp[] = DETAIL;

/** Resolve the close-up set for a category. */
export function resolveCloseUps(category: string | null | undefined): CloseUp[] {
  const key = category?.trim().toLowerCase() ?? "";
  return CATEGORY_CLOSEUPS[key] ?? DEFAULT_CLOSEUPS;
}

/**
 * Look up a single crop region by id within a category (e.g. "pleats", "salwar",
 * "pallu"). Used by the catalogue card resolver for model-crop cards and for the
 * base-crop fallback when an uploaded detail image is absent.
 */
export function cropRegionFor(
  category: string | null | undefined,
  cropId: string
): CloseUp | undefined {
  return resolveCloseUps(category).find((c) => c.id === cropId);
}

/**
 * Derive a close-up delivery URL by cropping a region of a base Cloudinary
 * image. Returns the original URL unchanged if it isn't a Cloudinary upload URL.
 */
export function buildCropUrl(baseUrl: string, region: CropRegion): string {
  const transform = `c_crop,w_${region.w},h_${region.h},x_${region.x},y_${region.y}`;
  const marker = "/upload/";
  const idx = baseUrl.indexOf(marker);
  if (idx === -1) return baseUrl;
  const at = idx + marker.length;
  return baseUrl.slice(0, at) + transform + "/" + baseUrl.slice(at);
}

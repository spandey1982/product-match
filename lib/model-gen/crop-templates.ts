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

// ── Category close-up sets (Task 4) ──────────────────────────────────────────

// Saree → Front Full, Back Full, Front Top, Front Bottom, Back Top (5 total)
const SAREE: CloseUp[] = [
  { id: "front-top",    label: "Front Top Close-Up",    from: "front", region: { x: 0.10, y: 0.02, w: 0.80, h: 0.42 } },
  { id: "front-bottom", label: "Front Bottom Close-Up", from: "front", region: { x: 0.10, y: 0.55, w: 0.80, h: 0.43 } },
  { id: "back-top",     label: "Back Top Close-Up",     from: "back",  region: { x: 0.10, y: 0.02, w: 0.80, h: 0.42 } },
];

// Lehenga → Front Full, Back Full, Front Top, Front Bottom (4 total)
const LEHENGA: CloseUp[] = [
  { id: "front-top",    label: "Front Top Close-Up",    from: "front", region: { x: 0.12, y: 0.05, w: 0.76, h: 0.40 } },
  { id: "front-bottom", label: "Front Bottom Close-Up", from: "front", region: { x: 0.05, y: 0.50, w: 0.90, h: 0.48 } },
];

// Kurti / T-Shirt / Shirt / Trouser / Leggings / similar → Front, Back, Detail (3 total)
const DETAIL: CloseUp[] = [
  { id: "detail", label: "Detail Close-Up", from: "front", region: { x: 0.25, y: 0.08, w: 0.50, h: 0.30 } },
];

const CATEGORY_CLOSEUPS: Record<string, CloseUp[]> = {
  saree: SAREE,
  dupatta: SAREE,
  lehenga: LEHENGA,
  sharara: LEHENGA,
  // kurta/kurti/shirt/trouser/leggings/t-shirt/etc. → DETAIL (default)
};

/** The default close-up set for categories without a specific template. */
export const DEFAULT_CLOSEUPS: CloseUp[] = DETAIL;

/** Resolve the close-up set for a category. */
export function resolveCloseUps(category: string | null | undefined): CloseUp[] {
  const key = category?.trim().toLowerCase() ?? "";
  return CATEGORY_CLOSEUPS[key] ?? DEFAULT_CLOSEUPS;
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

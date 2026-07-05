/**
 * Normalize a generated Cloudinary image to uniform dimensions.
 *
 * Generation backends (Gemini, Vertex) return varying aspect ratios — portrait,
 * square, sometimes larger. We splice a Cloudinary transformation into the
 * delivery URL so every try-on result becomes the same 3:4 portrait canvas at a
 * fixed width. `c_pad` never crops (no cut-off heads/feet); the padding uses the
 * trial-room card background colour so the bars are invisible in the grid.
 *
 * Non-destructive: the original asset is untouched; Cloudinary renders and
 * CDN-caches the derived size on first request.
 */

// 3:4 portrait, fixed 1024px wide → uniform 1024×1365. b_rgb:f9fafb matches the
// card's bg-gray-50 so padding blends in.
const TRYON_NORMALIZE = "c_pad,ar_3:4,w_1024,b_rgb:f9fafb";

/** Insert a transformation segment right after Cloudinary's `/upload/`. */
function insertTransform(secureUrl: string, transform: string): string {
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return secureUrl;
  const at = idx + marker.length;
  return secureUrl.slice(0, at) + transform + "/" + secureUrl.slice(at);
}

/**
 * Return a uniform-dimension delivery URL for a generated try-on image, or the
 * original URL unchanged if it isn't a recognizable Cloudinary upload URL.
 */
export function normalizeTryOnUrl(secureUrl: string): string {
  return insertTransform(secureUrl, TRYON_NORMALIZE);
}

// 3:4 portrait for catalogue MODEL shots (front/back/on-model) — a native crop,
// never a pad. Gemini's imageConfig requests aspectRatio "3:4" but its actual
// 1K/2K output snaps to ~896x1200 (ratio ~0.7467, not exactly 0.75), so there's
// always a sliver to reconcile one way or the other. c_fill crops to fill the
// target canvas completely (g_auto picks the content-aware region to keep)
// instead of c_pad's old approach of inventing extra canvas and painting a
// border-extended background into it — no padding, no gimmick bars, ever.
const CATALOGUE_NORMALIZE = "c_fill,ar_3:4,g_auto,w_1200";

/**
 * Uniform-dimension delivery URL for a catalogue full-body model shot, so a
 * catalogue's shots — and shots across catalogues — share one aspect, framed
 * with a real crop rather than padding. Detail close-ups already carry their
 * own native 3:4 crop from generation and must NOT be passed here. Returns the
 * URL unchanged if it isn't a recognizable Cloudinary upload URL.
 */
export function normalizeCatalogueUrl(secureUrl: string): string {
  return insertTransform(secureUrl, CATALOGUE_NORMALIZE);
}

/** Views that are full-body shots needing 3:4 normalization — everything else
 * (close-up crops, or `undefined` for the retailer's raw upload) already has
 * its final framing and must pass through untouched. */
export const FULL_MODEL_VIEWS = new Set(["on-model", "front", "back"]);

/**
 * Resolve the display URL for a generated image given its `view`: full-body
 * shots get the 3:4 native-crop treatment above; everything else is returned
 * as-is. Shared by the catalogue grid, the product detail page, and the
 * full-screen viewer so all three frame a given image identically.
 */
export function framedImageUrl(url: string, view: string | undefined): string {
  return view && FULL_MODEL_VIEWS.has(view) ? normalizeCatalogueUrl(url) : url;
}

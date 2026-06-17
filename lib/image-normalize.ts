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

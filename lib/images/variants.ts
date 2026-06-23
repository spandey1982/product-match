/**
 * Image variant delivery (HQ pipeline, steps 1 & 3).
 *
 * One stored master image → three delivery URLs built as Cloudinary
 * transformations. No extra files are stored and no extra AI calls are made:
 * Cloudinary renders each variant on first request and CDN-caches it.
 *
 *   MASTER    — zoom / download / social. Upscaled ~2048px + sharpened.
 *   DISPLAY   — product detail, try-on, catalogue cards. ~1200px.
 *   THUMBNAIL — grids, lists, recommendations. ~400px.
 *
 * All variants use f_auto (AVIF/WebP when supported) + q_auto (smart quality),
 * which the codebase currently does NOT apply anywhere — the biggest free win.
 *
 * The transform is inserted as the LAST step in the Cloudinary chain (just
 * before the version segment) so it composes correctly on top of any existing
 * transforms already baked into the stored URL — branding overlays (`l_…`),
 * close-up crops (`c_crop`), and try-on normalization (`c_pad`).
 */

const AUTO = "f_auto,q_auto";

export const VARIANT_TRANSFORM = {
  // c_scale enlarges (interpolation) — perceived sharpness via e_sharpen. True
  // detail recovery is the optional AI tier (step 6), not this baseline.
  master: `${AUTO},c_scale,w_2048,e_sharpen:60`,
  display: `${AUTO},c_limit,w_1200`,
  thumbnail: `${AUTO},c_limit,w_400`,
} as const;

export type VariantType = keyof typeof VARIANT_TRANSFORM;

/**
 * Insert a transform as the final chained component of a Cloudinary URL, right
 * before the `/v<version>/` segment (so it runs after any existing transforms).
 * Returns the URL unchanged if it isn't a Cloudinary upload URL (e.g. an
 * external product image pasted by URL).
 */
function insertDeliveryTransform(url: string, transform: string): string {
  if (!url || !url.includes("/upload/")) return url;

  // Prefer inserting just before the version segment (always present on
  // Cloudinary upload URLs): .../upload/<existing?>/v123/<public_id>.
  const version = url.match(/\/v\d+\//);
  if (version && version.index !== undefined) {
    const at = version.index; // position of the leading slash of "/v123/"
    return `${url.slice(0, at)}/${transform}${url.slice(at)}`;
  }

  // No version segment → insert right after "/upload/".
  const marker = "/upload/";
  const at = url.indexOf(marker) + marker.length;
  return url.slice(0, at) + transform + "/" + url.slice(at);
}

export function variantUrl(url: string, variant: VariantType): string {
  return insertDeliveryTransform(url, VARIANT_TRANSFORM[variant]);
}

export const masterUrl = (url: string) => variantUrl(url, "master");
export const displayUrl = (url: string) => variantUrl(url, "display");
export const thumbnailUrl = (url: string) => variantUrl(url, "thumbnail");

export interface ImageVariants {
  master: string;
  display: string;
  thumbnail: string;
}

export function imageVariants(url: string): ImageVariants {
  return {
    master: masterUrl(url),
    display: displayUrl(url),
    thumbnail: thumbnailUrl(url),
  };
}

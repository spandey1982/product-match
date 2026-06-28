/**
 * Non-AI enhancement for uploaded catalogue detail images.
 *
 * A pure Cloudinary delivery transform (verified 200 against the transform
 * engine): frames the uploaded image to the uniform 3:4 card with `c_fill` +
 * `g_auto` (trims dead margins, keeps the subject), then a light auto-improve
 * and gentle sharpen for cleaner light/texture. NO design/pattern change, no AI,
 * reversible (the stored asset is untouched). Returns the URL unchanged for a
 * non-Cloudinary upload URL.
 */

const ENHANCE = "c_fill,g_auto,ar_3:4,w_1200,e_improve,e_sharpen:60";

export function enhanceUploadUrl(secureUrl: string): string {
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return secureUrl;
  const at = idx + marker.length;
  return secureUrl.slice(0, at) + ENHANCE + "/" + secureUrl.slice(at);
}

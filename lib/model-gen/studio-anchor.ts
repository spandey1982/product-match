/**
 * Studio anchor — the "minimal background data" consistency lever (Phase 2+).
 *
 * Two independently-generated base shots (front, back) can drift in their
 * realized backdrop colour even when they share the same studio description.
 * Rather than re-sending the whole front image into the back generation
 * (expensive, token-heavy), we extract ONE piece of minimal background data —
 * the dominant backdrop colour of the front shot — and pin the back shot's
 * prompt to it. Lighting/gradient/floor still come from the shared preset
 * fragment; this just locks the colour to what the model actually produced.
 *
 * Cheap + deterministic: Cloudinary averages the top strip (pure backdrop above
 * the model) down to a single pixel via a URL transform; we fetch that ~1px
 * image and read its RGB. No extra AI call. Fully non-fatal — any failure
 * returns null and the caller falls back to the shared studio description.
 */
import sharp from "sharp";

/**
 * Build a Cloudinary URL that crops the top strip of the shot (above the model,
 * i.e. pure backdrop) and scales it to 1×1 — a hardware-averaged single colour.
 * Returns null for non-Cloudinary URLs.
 */
function buildBackdropProbeUrl(secureUrl: string): string | null {
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return null;
  const insertAt = idx + marker.length;
  // Crop the top 16% (backdrop above the head), then average to a single pixel.
  const transform = "c_crop,g_north,h_0.16/c_scale,w_1,h_1";
  return secureUrl.slice(0, insertAt) + transform + "/" + secureUrl.slice(insertAt);
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/**
 * Sample the dominant backdrop colour of a generated studio shot as a hex
 * string (e.g. "#efe7d6"), or null on any failure.
 */
export async function sampleStudioColor(secureUrl: string): Promise<string | null> {
  try {
    const probe = buildBackdropProbeUrl(secureUrl);
    if (!probe) return null;

    const res = await fetch(probe);
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    const { data } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    if (data.length < 3) return null;

    return `#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`;
  } catch {
    return null;
  }
}

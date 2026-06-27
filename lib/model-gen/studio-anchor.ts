/**
 * Studio sampling — read actual pixels from a generated image, cheaply.
 *
 * Two uses, both deterministic and no-AI:
 *  • studio anchor (Phase 2): the dominant backdrop colour of the front shot,
 *    used to pin later views to its realized studio — "minimal background data"
 *    instead of re-sending the whole image.
 *  • adaptive branding (Phase 4+): the actual colour where the watermark sits,
 *    so the mark's colour is chosen against what's really behind it, on either
 *    provider's output (Gemini studio OR Vertex reference-model background).
 *
 * Mechanism: Cloudinary crops the requested region and averages it to a single
 * pixel via a URL transform; we fetch that ~1px image and read its RGB with
 * sharp. Fully non-fatal — any failure returns null and callers fall back.
 */
import sharp from "sharp";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Build a Cloudinary URL that crops a region (by gravity + width/height
 * fractions) and scales it to 1×1 — a hardware-averaged single colour. Returns
 * null for non-Cloudinary URLs.
 */
function buildProbeUrl(
  secureUrl: string,
  gravity: string,
  wFrac: number,
  hFrac: number
): string | null {
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return null;
  const insertAt = idx + marker.length;
  const transform = `c_crop,g_${gravity},w_${wFrac},h_${hFrac}/c_scale,w_1,h_1`;
  return secureUrl.slice(0, insertAt) + transform + "/" + secureUrl.slice(insertAt);
}

/** Average colour of a region of a generated image, or null on any failure. */
export async function sampleRegionRgb(
  secureUrl: string,
  gravity: string,
  wFrac: number,
  hFrac: number
): Promise<Rgb | null> {
  try {
    const probe = buildProbeUrl(secureUrl, gravity, wFrac, hFrac);
    if (!probe) return null;

    const res = await fetch(probe);
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    const { data } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    if (data.length < 3) return null;

    return { r: data[0], g: data[1], b: data[2] };
  } catch {
    return null;
  }
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/**
 * Sample the dominant backdrop colour of a generated studio shot as a hex
 * string (e.g. "#efe7d6") from its top strip (backdrop above the model), or
 * null on any failure.
 */
export async function sampleStudioColor(secureUrl: string): Promise<string | null> {
  const rgb = await sampleRegionRgb(secureUrl, "north", 1.0, 0.16);
  return rgb ? `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}` : null;
}

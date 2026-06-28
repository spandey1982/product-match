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
  hFrac: number,
  size = 1
): string | null {
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return null;
  const insertAt = idx + marker.length;
  const transform = `c_crop,g_${gravity},w_${wFrac},h_${hFrac}/c_scale,w_${size},h_${size}`;
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

/** Average colour + luminance variance of a region — used to find the calmest
 *  (least product-busy) corner for brand placement (R3). */
export interface RegionStat {
  rgb: Rgb;
  /** Luminance variance across a small grid: low = flat/backdrop, high = busy. */
  variance: number;
}

/**
 * Sample a region as a small NxN grid and return its average colour and
 * luminance variance. A flat backdrop corner has low variance; a corner full of
 * product/pattern/edges has high variance. Non-fatal (null on failure).
 */
export async function sampleRegionStat(
  secureUrl: string,
  gravity: string,
  wFrac: number,
  hFrac: number,
  size = 16
): Promise<RegionStat | null> {
  try {
    const probe = buildProbeUrl(secureUrl, gravity, wFrac, hFrac, size);
    if (!probe) return null;
    const res = await fetch(probe);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    const count = info.width * info.height;
    if (count < 1 || data.length < count * ch) return null;

    let sr = 0, sg = 0, sb = 0;
    const lums: number[] = [];
    for (let i = 0; i < count; i++) {
      const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2];
      sr += r; sg += g; sb += b;
      lums.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
    const rgb = { r: Math.round(sr / count), g: Math.round(sg / count), b: Math.round(sb / count) };
    const mean = lums.reduce((a, l) => a + l, 0) / count;
    const variance = lums.reduce((a, l) => a + (l - mean) * (l - mean), 0) / count;
    return { rgb, variance };
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

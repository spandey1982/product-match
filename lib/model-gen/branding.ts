/**
 * Store branding for generated model images.
 *
 * Adds a non-destructive Cloudinary overlay (the store logo, or the store name
 * as a text fallback) to a generated image's delivery URL. We splice the
 * transformation into the stored `secure_url` rather than re-uploading — the
 * original asset is untouched and the branded URL is rendered + CDN-cached by
 * Cloudinary on first request.
 *
 * Applied at the model-gen persistence boundary so it covers BOTH backends
 * (Gemini catalogue + Vertex quick-listing) without touching the shared try-on
 * upload path. A no-op when branding is disabled or there's nothing to show.
 */
import { db } from "@/lib/db";
import { getAiGenSettings, type BrandingPosition } from "./settings";
import { sampleRegionStat, type Rgb, type RegionStat } from "./studio-anchor";

export interface BrandingConfig {
  enabled: boolean;
  position: BrandingPosition;
  /** Cloudinary public_id of the store logo, if uploaded. */
  logoPublicId: string | null;
  /** Store name, used as a text watermark when there is no logo. */
  storeName: string | null;
}

/** Load the branding config for a product's owner. Never throws. */
export async function getBrandingConfig(userId: string): Promise<BrandingConfig> {
  try {
    const [user, settings] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { storeName: true, logoPublicId: true },
      }),
      getAiGenSettings(userId),
    ]);
    return {
      enabled: settings.brandingEnabled,
      position: settings.brandingPosition,
      logoPublicId: user?.logoPublicId ?? null,
      storeName: user?.storeName ?? null,
    };
  } catch {
    return { enabled: false, position: "top-right", logoPublicId: null, storeName: null };
  }
}

const GRAVITY: Record<BrandingPosition, string> = {
  "top-left": "north_west",
  "top-right": "north_east",
};

/**
 * How the watermark should render against the ACTUAL area it sits on. Resolved
 * per image by sampling the real corner pixels (resolveBrandingAdapt) — not the
 * preset's nominal colour — so the mark is legible on any output, Gemini studio
 * or Vertex reference-model background alike.
 *  • `mark` — "light" on dark/medium backgrounds, "dark" on light ones.
 *  • `brightness` — 0 (dark) … 1 (bright) luminance of that corner; eases the
 *    logo opacity so the mark stays subtle without disappearing.
 */
export interface BrandingAdapt {
  mark: "dark" | "light";
  brightness: number;
}

/** Premium mark tones — soft, never flat #fff / #000, so it reads as designed. */
const LIGHT_MARK_COLOR = "rgb:f7f4ee"; // warm ivory, for dark/medium backgrounds
const DARK_MARK_COLOR = "rgb:2b2723"; // warm near-black, for light backgrounds

/**
 * Perceived luminance 0 (black) … 1 (white). Below ~0.6 a light mark reads
 * best; medium-grey studios (≈0.5) therefore get the ivory mark + soft shadow.
 */
function luminance({ r, g, b }: Rgb): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** A resolved watermark treatment + the corner to place it in (R3). */
export interface BrandingPlacement extends BrandingAdapt {
  /** Cloudinary gravity for the chosen (calmest) corner, e.g. "north_east". */
  gravity: string;
}

const PLACEMENT_GRAVITIES: string[] = ["north_east", "north_west", "south_east", "south_west"];

/**
 * Coverage-aware placement (R3): sample all four corners of THIS image and put
 * the mark in the calmest one (lowest luminance variance = most likely
 * backdrop, least product), with the adaptive colour for that corner. The
 * retailer's configured corner wins when it's nearly as calm, so we only
 * relocate to avoid genuine product overlap. Falls back to the configured
 * corner + preset adapt if sampling fails. Never throws.
 */
export async function resolveBrandingPlacement(
  secureUrl: string,
  preferredPosition: BrandingPosition,
  fallback: BrandingAdapt
): Promise<BrandingPlacement> {
  const preferredGravity = GRAVITY[preferredPosition];
  const stats = await Promise.all(
    PLACEMENT_GRAVITIES.map((g) => sampleRegionStat(secureUrl, g, 0.3, 0.2))
  );
  const scored = PLACEMENT_GRAVITIES
    .map((gravity, i) => ({ gravity, stat: stats[i] }))
    .filter((c): c is { gravity: string; stat: RegionStat } => c.stat !== null);

  if (scored.length === 0) return { ...fallback, gravity: preferredGravity };

  scored.sort((a, b) => a.stat.variance - b.stat.variance);
  const calmest = scored[0];
  const preferred = scored.find((c) => c.gravity === preferredGravity);
  const chosen =
    preferred && preferred.stat.variance <= calmest.stat.variance * 1.25 ? preferred : calmest;

  const lum = luminance(chosen.stat.rgb);
  return { mark: lum < 0.6 ? "light" : "dark", brightness: lum, gravity: chosen.gravity };
}

/** Logo opacity tuned to the corner: lighter background → subtler mark. */
function logoOpacity(adapt?: BrandingAdapt): number {
  if (!adapt) return 85;
  return Math.max(70, Math.min(90, Math.round(94 - adapt.brightness * 26)));
}

/** Cloudinary-escape text for a `l_text:` layer (commas, slashes, %, spaces). */
function escapeText(text: string): string {
  // Cloudinary needs commas/slashes double-escaped inside layer text; encode
  // the rest. Keep it simple and safe for a short watermark.
  return encodeURIComponent(text.replace(/,/g, "%252C").replace(/\//g, "%252F"));
}

/** Build the overlay transformation segment, or null if nothing to overlay. */
function buildOverlayTransform(config: BrandingConfig, placement?: BrandingPlacement): string | null {
  // Gravity = the coverage-aware corner when resolved, else the configured one.
  const gravity = placement?.gravity ?? GRAVITY[config.position];

  if (config.logoPublicId) {
    // Logo image overlay. Public-id path separators become ":" in a layer ref.
    // Opacity eases with the corner's brightness so the mark stays subtle.
    const layer = config.logoPublicId.replace(/\//g, ":");
    return `l_${layer},w_0.18,fl_relative,o_${logoOpacity(placement)},g_${gravity},x_0.04,y_0.04`;
  }

  const name = config.storeName?.trim();
  if (name) {
    // A refined wordmark: medium weight + letter-spacing for an intentional,
    // boutique feel, in a soft premium tone chosen for the real background.
    // Size + offset are RELATIVE (fl_relative) so the mark is a consistent
    // FRACTION of each image — base shots and the smaller close-up crops render
    // it at the same proportional size, not a fixed px that balloons on crops.
    const label = `l_text:Arial_50_bold_letter_spacing_3:${escapeText(name)}`;
    const sizing = "fl_relative,w_0.2";
    const place = `g_${gravity},x_0.04,y_0.04`;
    if ((placement?.mark ?? "light") === "light") {
      // Ivory mark + soft shadow → legible on dark/medium/vignetted corners.
      return `${label},${sizing},co_${LIGHT_MARK_COLOR},e_shadow:30,o_92,${place}`;
    }
    // Warm near-black mark → clean and legible on genuinely light backdrops.
    return `${label},${sizing},co_${DARK_MARK_COLOR},o_88,${place}`;
  }

  return null;
}

/**
 * Return a branded delivery URL for a Cloudinary image, or the original URL
 * unchanged when branding is off / there's no logo or name / the URL isn't a
 * recognizable Cloudinary upload URL.
 *
 * `placement` (optional) tailors the watermark's colour AND corner to the
 * actual image — see resolveBrandingPlacement. When omitted, the mark renders
 * at the configured corner in its default (light) treatment (legacy callers).
 */
export function applyBranding(
  secureUrl: string,
  config: BrandingConfig,
  placement?: BrandingPlacement
): string {
  if (!config.enabled) return secureUrl;

  const transform = buildOverlayTransform(config, placement);
  if (!transform) return secureUrl;
  if (!secureUrl.includes("/upload/")) return secureUrl;

  // Insert the overlay as the LAST transform, before the /v<version>/ segment.
  // Critical for close-ups: their URL already carries a c_crop right after
  // /upload/, so chaining the overlay here brands the CROPPED image rather than
  // branding the full base and then cropping it (which truncated the mark).
  const version = secureUrl.match(/\/v\d+\//);
  if (version && version.index !== undefined) {
    const at = version.index;
    return `${secureUrl.slice(0, at)}/${transform}${secureUrl.slice(at)}`;
  }

  const marker = "/upload/";
  const at = secureUrl.indexOf(marker) + marker.length;
  return secureUrl.slice(0, at) + transform + "/" + secureUrl.slice(at);
}

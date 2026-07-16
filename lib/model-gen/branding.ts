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
import { sampleRegionStat, type Rgb } from "./studio-anchor";

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

// Scrim/plate tones — the soft translucent panel the wordmark sits on so it
// always reads cleanly and looks intentional, tinted to match the background.
const DARK_PLATE = "rgb:1f1b18"; // charcoal plate, under an ivory mark (dark/medium bg)
const LIGHT_PLATE = "rgb:f4efe7"; // ivory plate, under a charcoal mark (light bg)

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

/** Branding always sits in the top-left corner (retailer positioning removed). */
const BRAND_GRAVITY = "north_west";

/**
 * Resolve the watermark treatment for THIS image. Branding position is fixed
 * to the top-left corner (a single, predictable, professional placement — the
 * old "calmest corner" search confused flat product/skin areas with backdrop
 * and had no good answer on busy Scenic frames). We still sample the top-left
 * area to choose the mark TONE so the scrim/plate reads well and feels tinted
 * to the background rather than pasted on. Falls back to the preset adapt if
 * sampling fails. Never throws.
 */
export async function resolveBrandingPlacement(
  secureUrl: string,
  _preferredPosition: BrandingPosition, // retained for signature stability; ignored
  fallback: BrandingAdapt
): Promise<BrandingPlacement> {
  const stat = await sampleRegionStat(secureUrl, BRAND_GRAVITY, 0.34, 0.22);
  if (!stat) return { ...fallback, gravity: BRAND_GRAVITY };
  const lum = luminance(stat.rgb);
  return { mark: lum < 0.58 ? "light" : "dark", brightness: lum, gravity: BRAND_GRAVITY };
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
  // Branding is always top-left now (retailer positioning removed).
  const gravity = BRAND_GRAVITY;
  const isLight = (placement?.mark ?? "light") === "light";

  if (config.logoPublicId) {
    // Logo image overlay. Public-id path separators become ":" in a layer ref.
    // Opacity eases with the corner's brightness so the mark stays subtle.
    const layer = config.logoPublicId.replace(/\//g, ":");
    return `l_${layer},w_0.18,fl_relative,o_${logoOpacity(placement)},g_${gravity},x_0.04,y_0.04`;
  }

  const name = config.storeName?.trim();
  if (name) {
    // A refined wordmark on a soft, rounded translucent SCRIM PLATE, so it
    // always reads cleanly and looks intentional on any background — studio or
    // busy Scenic — instead of flat text pasted on top. The plate is tinted to
    // the background (dark plate + ivory ink on dark/medium areas; ivory plate
    // + charcoal ink on light ones) so it feels integrated, not tacky.
    //   • b_<plate>          → the plate fill behind the text
    //   • bo_<n>px_solid_<plate> → matched border = even padding around the text
    //   • r_14               → soft rounded corners
    //   • fl_relative,w_     → mark is a consistent FRACTION of each image, so
    //                          base shots and smaller close-up crops match
    //   • o_                 → whole layer kept subtle, not overpowering
    const label = `l_text:Arial_42_bold_letter_spacing_2:${escapeText(name)}`;
    const ink = isLight ? LIGHT_MARK_COLOR : DARK_MARK_COLOR;
    const plate = isLight ? DARK_PLATE : LIGHT_PLATE;
    const style = `co_${ink},b_${plate},bo_16px_solid_${plate},r_14`;
    const sizing = "fl_relative,w_0.22";
    const place = `g_${gravity},x_0.03,y_0.03,o_80`;
    return `${label},${style},${sizing},${place}`;
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

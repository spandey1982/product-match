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
import { getAiGenSettings, type BrandingPosition, type BrandingStyle } from "./settings";
import { sampleRegionStat, type Rgb } from "./studio-anchor";

export interface BrandingConfig {
  enabled: boolean;
  position: BrandingPosition;
  /** Watermark look — classic text wordmark, or the frosted-glass chip. */
  style: BrandingStyle;
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
      style: settings.brandingStyle,
      logoPublicId: user?.logoPublicId ?? null,
      storeName: user?.storeName ?? null,
    };
  } catch {
    return { enabled: false, position: "top-right", style: "classic", logoPublicId: null, storeName: null };
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

// Wordmark ink — soft premium tones (never flat #fff/#000), chosen against the
// real background. Ivory on dark/medium, calm Onyx-ish near-black on light.
const LIGHT_MARK_COLOR = "rgb:f7f4ee"; // warm ivory, for dark/medium backgrounds
const DARK_MARK_COLOR = "rgb:353839"; // calm Onyx near-black, for light backgrounds

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

/** Cloudinary public_id (":"-joined) of the frosted-glass chip asset. */
const GLASS_CHIP_ID = "product-match:brand:glass-chip-2";

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

  if (config.logoPublicId) {
    // Logo image overlay. Public-id path separators become ":" in a layer ref.
    // Opacity eases with the corner's brightness so the mark stays subtle.
    const layer = config.logoPublicId.replace(/\//g, ":");
    return `l_${layer},w_0.18,fl_relative,o_${logoOpacity(placement)},g_${gravity},x_0.04,y_0.04`;
  }

  const name = config.storeName?.trim();
  if (name) {
    // GLASS style: the wordmark on a designed translucent glass-chip PNG asset
    // (gloss + rounded ends baked in — URL params can't produce that), with the
    // name in calm Onyx centred on top. The chip + text sizing/offsets are tuned
    // to sit with modest even padding; both are relative fractions so base shots
    // and smaller crops match. Onyx reads on the light frosted glass on any bg.
    if (config.style === "glass") {
      const chip = `l_${GLASS_CHIP_ID},fl_relative,w_0.2,g_${gravity},x_0.04,y_0.04`;
      const text = `l_text:Arial_50_bold_letter_spacing_3:${escapeText(name)},co_${DARK_MARK_COLOR},fl_relative,w_0.165,g_${gravity},x_0.0575,y_0.049`;
      return `${chip}/${text}`;
    }

    // CLASSIC style: the refined adaptive text wordmark — Arial 50 bold,
    // letter-spacing 3, w_0.2, adaptive premium tone + soft shadow so it reads
    // on any background without a chip.
    const label = `l_text:Arial_50_bold_letter_spacing_3:${escapeText(name)}`;
    const sizing = "fl_relative,w_0.2";
    const place = `g_${gravity},x_0.04,y_0.04`;
    return (placement?.mark ?? "light") === "light"
      ? `${label},${sizing},co_${LIGHT_MARK_COLOR},e_shadow:30,o_92,${place}`
      : `${label},${sizing},co_${DARK_MARK_COLOR},o_90,${place}`;
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

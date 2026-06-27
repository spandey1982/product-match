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
 * Backdrop-derived hints for adaptive branding (Phase 4). Lets the watermark
 * read against the chosen studio instead of being pasted on identically:
 *  • `mark` — "dark" on light/bright backdrops, "light" on dark ones. Drives
 *    the text watermark colour (a white label is invisible on Boutique Beige).
 *  • `brightness` — 0 (dark) … 1 (bright). Brighter studios let the logo sit
 *    more subtly, so opacity eases down a touch.
 * Deterministic, no AI. Optional — when absent, branding keeps its prior look.
 */
export interface BrandingAdapt {
  mark: "dark" | "light";
  brightness: number;
}

/** Logo opacity tuned to the backdrop: brighter studio → subtler mark. */
function logoOpacity(adapt?: BrandingAdapt): number {
  if (!adapt) return 85;
  return Math.max(68, Math.min(88, Math.round(92 - adapt.brightness * 26)));
}

/** Deep neutral for a dark watermark — premium, not flat black. */
const DARK_MARK_COLOR = "rgb:3f3a34";

/** Cloudinary-escape text for a `l_text:` layer (commas, slashes, %, spaces). */
function escapeText(text: string): string {
  // Cloudinary needs commas/slashes double-escaped inside layer text; encode
  // the rest. Keep it simple and safe for a short watermark.
  return encodeURIComponent(text.replace(/,/g, "%252C").replace(/\//g, "%252F"));
}

/** Build the overlay transformation segment, or null if nothing to overlay. */
function buildOverlayTransform(config: BrandingConfig, adapt?: BrandingAdapt): string | null {
  const gravity = GRAVITY[config.position];

  if (config.logoPublicId) {
    // Logo image overlay. Public-id path separators become ":" in a layer ref.
    // Opacity eases with backdrop brightness so the mark stays subtle.
    const layer = config.logoPublicId.replace(/\//g, ":");
    return `l_${layer},w_0.18,fl_relative,o_${logoOpacity(adapt)},g_${gravity},x_0.04,y_0.04`;
  }

  const name = config.storeName?.trim();
  if (name) {
    // Text watermark, adapted to the backdrop. On light/bright studios a white
    // label disappears, so use a deep-neutral mark (clean, no heavy shadow);
    // on dark studios keep the white label with a soft shadow for legibility.
    if ((adapt?.mark ?? "light") === "dark") {
      return `l_text:Arial_36_bold:${escapeText(name)},co_${DARK_MARK_COLOR},o_72,g_${gravity},x_30,y_25`;
    }
    return `l_text:Arial_36_bold:${escapeText(name)},co_white,e_shadow:40,o_90,g_${gravity},x_30,y_25`;
  }

  return null;
}

/**
 * Return a branded delivery URL for a Cloudinary image, or the original URL
 * unchanged when branding is off / there's no logo or name / the URL isn't a
 * recognizable Cloudinary upload URL.
 *
 * `adapt` (optional) tailors the watermark to the chosen backdrop — see
 * BrandingAdapt. When omitted, branding renders exactly as before.
 */
export function applyBranding(
  secureUrl: string,
  config: BrandingConfig,
  adapt?: BrandingAdapt
): string {
  if (!config.enabled) return secureUrl;

  const transform = buildOverlayTransform(config, adapt);
  if (!transform) return secureUrl;

  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return secureUrl;

  const insertAt = idx + marker.length;
  return secureUrl.slice(0, insertAt) + transform + "/" + secureUrl.slice(insertAt);
}

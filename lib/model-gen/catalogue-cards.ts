/**
 * Catalogue card-stack resolver (R2).
 *
 * Turns the per-category card-stack definition (part-slots.ts) + the retailer's
 * uploaded part images + the generated base shots into the ORDERED list of
 * display cards, each resolved to a final (pre-branding) delivery URL:
 *
 *   ai-base    → the generated base shot, as-is (front/back). The 3:4 uniform
 *                framing for these full-body views is applied at display
 *                (normalizeCatalogueUrl), so existing products get it too.
 *   model-crop → a native 3:4 crop of a base shot (a detail that exists only on
 *                the model, e.g. saree pleats, kurti salwar) — see cropToCard.
 *   upload     → the retailer's uploaded image for the slot, enhanced + framed
 *                to 3:4 (non-AI). Currently disabled (USE_UPLOADED_PART_IMAGES):
 *                every upload-kind card falls back to its base-crop instead, or
 *                is omitted when there's no fallback (e.g. saree border).
 *
 * Branding is applied LATER by the engine, on each final card — so a close-up is
 * never a crop of an already-branded base. Pure: returns URLs only.
 */
import { catalogueCardsFor, type PartImage } from "@/lib/product/part-slots";
import { cropRegionFor, expandToAspectRatio } from "./crop-templates";
import { enhanceUploadUrl } from "@/lib/images/enhance";
import type { CropRegion } from "./crop-templates";

// Gemini's imageConfig requests aspectRatio "3:4" (lib/model-gen/quality.ts), but
// its actual 1K/2K output snaps to 896x1200 (ratio ~0.7467), not exactly 0.75.
// Using the measured ratio here (rather than the idealized 3/4) keeps expanded
// crops pixel-exact 3:4, matching the CARD_ASPECT delivered to the catalogue grid.
const BASE_SHOT_ASPECT = 896 / 1200;
const CARD_ASPECT = 3 / 4;

// Temporarily disabled pending retailer feedback: catalogue cards always use
// the base-shot crop for a slot, even when the retailer uploaded their own
// part image for it. Do NOT delete the upload branch below — flip this back
// to true to restore "retailer's upload wins" once a decision is made.
const USE_UPLOADED_PART_IMAGES = false;

/** A base shot available to the resolver. */
interface BaseRef {
  url: string;
  provider: string;
}

export interface ResolvedCard {
  url: string;
  /** Stored on ProductImage.view; the display key. */
  view: string;
  source: "ai-base" | "model-crop" | "upload";
  provider?: string;
}

export interface ResolveStackInput {
  category: string;
  /** Generated base shots by view. */
  baseShots: Partial<Record<"front" | "back", BaseRef>>;
  /** Retailer's uploaded detail images (the "others" slots). */
  partImages: PartImage[];
  /** The main product image URL — the "main" upload slot (e.g. lehenga card). */
  mainImageUrl: string;
}

const CARD_WIDTH = 1200;
const CARD_HEIGHT = Math.round(CARD_WIDTH / CARD_ASPECT);

/**
 * Crop the base image directly to a native 3:4 window (no padding, no border
 * extension): the subject region is expanded to 3:4 around its own center,
 * then scaled to the uniform card delivery size.
 *
 * The final `c_scale,w_,h_` (both dimensions, not just width) is deliberate:
 * Cloudinary's fractional c_crop rounds w/h to whole pixels independently, so
 * the crop it actually produces can be a fraction of a percent off 3:4. Fixing
 * both output dimensions absorbs that sub-pixel rounding instead of leaking it
 * into the delivered aspect ratio — the resulting stretch is imperceptible
 * (<1%), far below the gross distortion the old pad-based pipeline produced.
 */
function cropToCard(baseUrl: string, region: CropRegion): string {
  const window = expandToAspectRatio(region, BASE_SHOT_ASPECT, CARD_ASPECT);
  const transform =
    `c_crop,w_${window.w},h_${window.h},x_${window.x},y_${window.y}` +
    `/c_scale,w_${CARD_WIDTH},h_${CARD_HEIGHT}`;
  const marker = "/upload/";
  const idx = baseUrl.indexOf(marker);
  if (idx === -1) return baseUrl;
  const at = idx + marker.length;
  return baseUrl.slice(0, at) + transform + "/" + baseUrl.slice(at);
}

/** Resolve a base-crop card (model-crop or upload fallback), or null. */
function cropCard(
  input: ResolveStackInput,
  view: string,
  cropId: string
): ResolvedCard | null {
  const region = cropRegionFor(input.category, cropId);
  if (!region) return null;
  const base = input.baseShots[region.from];
  if (!base) return null;
  return { url: cropToCard(base.url, region.region), view, source: "model-crop", provider: base.provider };
}

export function resolveCatalogueStack(input: ResolveStackInput): ResolvedCard[] {
  const out: ResolvedCard[] = [];

  for (const card of catalogueCardsFor(input.category)) {
    if (card.kind === "ai-base") {
      const base = card.base ? input.baseShots[card.base] : undefined;
      if (base) out.push({ url: base.url, view: card.id, source: "ai-base", provider: base.provider });
      continue;
    }

    if (card.kind === "model-crop") {
      const resolved = cropCard(input, card.id, card.cropId ?? card.id);
      if (resolved) out.push(resolved);
      continue;
    }

    // upload — the retailer's image for this slot, enhanced + framed. Disabled
    // for now (see USE_UPLOADED_PART_IMAGES): falls through to the base-crop
    // fallback below even when an upload exists for the slot.
    const uploadUrl = USE_UPLOADED_PART_IMAGES
      ? card.slot === "main"
        ? input.mainImageUrl
        : input.partImages.find((p) => p.slot === card.slot)?.url
      : undefined;
    if (uploadUrl) {
      out.push({ url: enhanceUploadUrl(uploadUrl), view: card.id, source: "upload" });
    } else if (card.fallbackCropId) {
      const resolved = cropCard(input, card.id, card.fallbackCropId);
      if (resolved) out.push(resolved);
    }
    // else: no upload + no fallback → omit (e.g. saree border).
  }

  return out;
}

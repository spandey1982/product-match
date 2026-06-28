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
 *   model-crop → a crop of a base shot, padded to the 3:4 card (a detail that
 *                exists only on the model, e.g. saree pleats, kurti salwar).
 *   upload     → the retailer's uploaded image for the slot, enhanced + framed
 *                to 3:4 (non-AI). Falls back to a base-crop when absent; omitted
 *                entirely when there's no fallback (e.g. saree border).
 *
 * Branding is applied LATER by the engine, on each final card — so a close-up is
 * never a crop of an already-branded base. Pure: returns URLs only.
 */
import { catalogueCardsFor, type PartImage } from "@/lib/product/part-slots";
import { cropRegionFor } from "./crop-templates";
import { enhanceUploadUrl } from "@/lib/images/enhance";
import type { CropRegion } from "./crop-templates";

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

/** Crop a base region, then pad the crop to the uniform 3:4 card. Verified 200. */
function cropToCard(baseUrl: string, region: CropRegion): string {
  const transform =
    `c_crop,w_${region.w},h_${region.h},x_${region.x},y_${region.y}` +
    `/c_pad,ar_3:4,w_1200,b_auto:border`;
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

    // upload — the retailer's image for this slot, enhanced + framed.
    const uploadUrl =
      card.slot === "main"
        ? input.mainImageUrl
        : input.partImages.find((p) => p.slot === card.slot)?.url;
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

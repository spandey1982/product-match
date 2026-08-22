/**
 * Catalogue Motion Storyboard Library — per-category shot sequences.
 *
 * Each category maps to a default storyboard: an ordered list of shots with
 * camera movements, durations, and source image mappings. Storyboard
 * selection is automatic, driven by `product.category`. The shot `view`
 * values align with ProductImage.view so the source resolver can map each
 * shot to an existing catalogue image.
 *
 * Analogous to lib/product/part-slots.ts (category-keyed data with a
 * default fallback).
 */
import type { Storyboard, StoryboardShot } from "./types";

// ── Shot builders (reduce repetition without abstracting too far) ────────
//
// modelShot → the full front/back base image (the worn garment on the
// model). Routed to a real AI provider (ai-motion) — the only place subtle
// motion of a person adds value and the only shots worth Veo's per-second,
// 4/6/8s-minimum billing.
// detailShot → a cropped close-up (no person in frame) or, for object-only
// categories, the full product shot. Always pan-zoom: rendered locally via
// deterministic FFmpeg crop/zoom, zero AI cost, no duration floor.

function modelShot(
  view: string,
  label: string,
  presetId: string,
  durationSec: number,
  sourceBase: "front" | "back",
  rationale: string,
): StoryboardShot {
  return { view, label, presetId, durationSec, sourceBase, renderMode: "ai-motion", rationale };
}

function detailShot(
  view: string,
  label: string,
  presetId: string,
  durationSec: number,
  sourceBase: "front" | "back",
  rationale: string,
  cropId?: string,
): StoryboardShot {
  return { view, label, presetId, durationSec, sourceBase, renderMode: "pan-zoom", rationale, cropId };
}

// ── Category storyboards ────────────────────────────────────────────────

const SAREE: Storyboard = {
  categoryKey: "saree",
  label: "Saree",
  totalDurationSec: 8.5,
  shots: [
    modelShot("front", "Front Full", "slow-push-in", 2.5, "front", "Establish overall drape and silhouette"),
    detailShot("blouse", "Blouse", "tilt-up", 1.5, "front", "Blouse design, neckline, sleeve detail", "blouse"),
    detailShot("pallu", "Pallu", "diagonal-slide", 1.5, "back", "Pallu motif and cascade line", "pallu"),
    detailShot("pleats", "Pleats", "macro-push", 1, "front", "Pleat structure and fabric behavior", "pleats"),
    modelShot("back", "Back Full", "slow-pull-out", 2, "back", "Back drape, pallu continuation"),
  ],
};

const LEHENGA: Storyboard = {
  categoryKey: "lehenga",
  label: "Lehenga",
  totalDurationSec: 8.5,
  shots: [
    modelShot("front", "Front Full", "slow-push-in", 2, "front", "Overall silhouette and embroidery impact"),
    detailShot("lehenga-detail", "Embroidery", "macro-push", 1.5, "front", "Close-up of embellishment craftsmanship", "lehenga-detail"),
    detailShot("dupatta", "Dupatta", "horizontal-slide", 1.5, "front", "Dupatta drape and matching detail"),
    detailShot("skirt", "Skirt", "tilt-down", 1.5, "front", "Skirt volume, border, hem detail"),
    modelShot("back", "Back Full", "slow-pull-out", 2, "back", "Back design and silhouette closure"),
  ],
};

const KURTI: Storyboard = {
  categoryKey: "kurti",
  label: "Kurti / Kurta",
  totalDurationSec: 6,
  shots: [
    modelShot("front", "Front Full", "slow-push-in", 2, "front", "Overall length, fit, pattern"),
    detailShot("design", "Neckline", "tilt-up", 1.5, "front", "Neckline design and sleeve detail", "design"),
    detailShot("fabric", "Fabric", "macro-push", 1, "front", "Fabric texture, weave, print fidelity"),
    modelShot("back", "Back Full", "detail-reveal", 1.5, "back", "Back design"),
  ],
};

const SHIRT: Storyboard = {
  categoryKey: "shirt",
  label: "Shirt",
  totalDurationSec: 6,
  shots: [
    modelShot("front", "Front Full", "slow-push-in", 1.5, "front", "Overall fit and styling"),
    detailShot("collar", "Collar", "macro-push", 1, "front", "Collar shape and stitching"),
    detailShot("design", "Button Line", "tilt-down", 1, "front", "Placket, button spacing, fabric drape", "design"),
    detailShot("fabric", "Fabric", "perspective-shift", 1, "front", "Fabric texture and weave at angle"),
    modelShot("back", "Back Full", "slow-pull-out", 1.5, "back", "Back fit, yoke, vent detail"),
  ],
};

const DRESS: Storyboard = {
  categoryKey: "dress",
  label: "Dress",
  totalDurationSec: 6.5,
  shots: [
    modelShot("front", "Front Full", "slow-push-in", 2, "front", "Silhouette, length, pattern"),
    detailShot("design", "Bodice", "tilt-up", 1.5, "front", "Neckline, sleeve, upper construction", "design"),
    detailShot("fabric", "Detail", "macro-push", 1, "front", "Fabric or embellishment close-up"),
    modelShot("back", "Back Full", "slow-pull-out", 2, "back", "Back design, closure, silhouette"),
  ],
};

const JACKET: Storyboard = {
  categoryKey: "jacket",
  label: "Jacket / Blazer",
  totalDurationSec: 7,
  shots: [
    modelShot("front", "Front Full", "slight-orbit", 2.5, "front", "Shoulder structure, lapels, fit"),
    detailShot("lapel", "Lapel", "macro-push", 1, "front", "Lapel shape, fabric, buttonhole"),
    detailShot("fabric", "Texture", "perspective-shift", 1.5, "front", "Fabric weave and surface under light"),
    modelShot("back", "Back Full", "slow-pull-out", 2, "back", "Back panel, vent, shoulder line"),
  ],
};

const TROUSER: Storyboard = {
  categoryKey: "trouser",
  label: "Jeans / Trousers",
  totalDurationSec: 5,
  shots: [
    modelShot("front", "Front Full", "tilt-down", 2, "front", "Waist, leg line, break at ankle"),
    detailShot("fabric", "Fabric", "macro-push", 1, "front", "Denim wash, weave, distressing"),
    modelShot("back", "Back Full", "slow-pull-out", 2, "back", "Back pocket, yoke, seat fit"),
  ],
};

// ── Object-only categories (no model in frame) — every shot is a free,
// deterministic pan-zoom. No shot here justifies Veo's per-second billing:
// there is no person whose subtle motion adds value, only the product.

const FOOTWEAR: Storyboard = {
  categoryKey: "footwear",
  label: "Shoes / Footwear",
  totalDurationSec: 6,
  shots: [
    detailShot("front", "45° Profile", "slight-orbit", 2, "front", "Hero angle — shape, profile, design"),
    detailShot("side", "Side", "horizontal-slide", 1.5, "front", "Full side profile, heel height"),
    detailShot("material", "Material", "macro-push", 1, "front", "Leather grain, stitching, texture"),
    detailShot("sole", "Sole", "tilt-down", 1.5, "front", "Sole construction and tread"),
  ],
};

const HANDBAG: Storyboard = {
  categoryKey: "handbag",
  label: "Handbag / Clutch",
  totalDurationSec: 6,
  shots: [
    detailShot("front", "Front", "slow-push-in", 2, "front", "Overall shape, closure, proportion"),
    detailShot("hardware", "Hardware", "macro-push", 1, "front", "Clasp, zipper, buckle quality"),
    detailShot("texture", "Texture", "perspective-shift", 1.5, "front", "Material surface under light"),
    detailShot("handle", "Handle", "tilt-up", 1.5, "front", "Handle or strap construction"),
  ],
};

const JEWELLERY: Storyboard = {
  categoryKey: "jewellery",
  label: "Jewellery",
  totalDurationSec: 7,
  shots: [
    detailShot("front", "Hero", "slow-push-in", 2, "front", "Full piece in premium lighting"),
    detailShot("detail", "Detail", "macro-push", 1.5, "front", "Stone setting, metalwork, engraving"),
    detailShot("shimmer", "Shimmer", "perspective-shift", 1.5, "front", "Light play across facets / surface"),
    detailShot("reveal", "Reveal", "detail-reveal", 2, "front", "Widening from detail to full piece"),
  ],
};

const DUPATTA: Storyboard = {
  categoryKey: "dupatta",
  label: "Dupatta",
  totalDurationSec: 5,
  shots: [
    detailShot("front", "Draped", "diagonal-slide", 2, "front", "Overall drape, color, pattern"),
    detailShot("border", "Border", "horizontal-slide", 1.5, "front", "Border detail and craftsmanship"),
    detailShot("fabric", "Texture", "macro-push", 1.5, "front", "Fabric weave, embroidery, surface"),
  ],
};

const ACCESSORY: Storyboard = {
  categoryKey: "accessory",
  label: "Accessories",
  totalDurationSec: 5,
  shots: [
    detailShot("front", "Full", "cinematic-drift", 2, "front", "Complete item in context"),
    detailShot("pattern", "Pattern", "macro-push", 1.5, "front", "Pattern, weave, print fidelity"),
    detailShot("detail", "Detail", "perspective-shift", 1.5, "front", "Material quality under light"),
  ],
};

// ── Default (front + back) ──────────────────────────────────────────────

const DEFAULT: Storyboard = {
  categoryKey: "default",
  label: "Default",
  totalDurationSec: 5,
  shots: [
    modelShot("front", "Front Full", "slow-push-in", 2, "front", "Overall garment presentation"),
    detailShot("design", "Design Detail", "macro-push", 1, "front", "Close-up detail", "design"),
    modelShot("back", "Back Full", "slow-pull-out", 2, "back", "Back view"),
  ],
};

// ── Category lookup ─────────────────────────────────────────────────────

const STORYBOARD_MAP: Record<string, Storyboard> = {
  saree: SAREE,
  dupatta: DUPATTA,
  lehenga: LEHENGA,
  sharara: LEHENGA,
  kurta: KURTI,
  kurti: KURTI,
  shirt: SHIRT,
  tshirt: SHIRT,
  dress: DRESS,
  anarkali: DRESS,
  suit: JACKET,
  waistcoat: JACKET,
  trouser: TROUSER,
  jeans: TROUSER,
  footwear: FOOTWEAR,
  jewellery: JEWELLERY,
  handbag: HANDBAG,
  clutch: HANDBAG,
  tie: ACCESSORY,
};

function normalize(category: string | null | undefined): string {
  return (category ?? "").toLowerCase().replace(/[\s_-]/g, "");
}

export function storyboardFor(category: string | null | undefined): Storyboard {
  return STORYBOARD_MAP[normalize(category)] ?? DEFAULT;
}

export function listStoryboards(): Storyboard[] {
  const seen = new Set<Storyboard>();
  for (const sb of Object.values(STORYBOARD_MAP)) {
    seen.add(sb);
  }
  return [...seen, DEFAULT];
}

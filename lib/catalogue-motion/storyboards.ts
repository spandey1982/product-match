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

function shot(
  view: string,
  label: string,
  presetId: string,
  durationSec: number,
  sourceBase: "front" | "back",
  rationale: string,
  cropId?: string,
): StoryboardShot {
  return { view, label, presetId, durationSec, sourceBase, rationale, cropId };
}

// ── Category storyboards ────────────────────────────────────────────────

const SAREE: Storyboard = {
  categoryKey: "saree",
  label: "Saree",
  totalDurationSec: 8.5,
  shots: [
    shot("front", "Front Full", "slow-push-in", 2.5, "front", "Establish overall drape and silhouette"),
    shot("blouse", "Blouse", "tilt-up", 1.5, "front", "Blouse design, neckline, sleeve detail", "blouse"),
    shot("pallu", "Pallu", "diagonal-slide", 1.5, "back", "Pallu motif and cascade line", "pallu"),
    shot("pleats", "Pleats", "macro-push", 1, "front", "Pleat structure and fabric behavior", "pleats"),
    shot("back", "Back Full", "slow-pull-out", 2, "back", "Back drape, pallu continuation"),
  ],
};

const LEHENGA: Storyboard = {
  categoryKey: "lehenga",
  label: "Lehenga",
  totalDurationSec: 8.5,
  shots: [
    shot("front", "Front Full", "slow-push-in", 2, "front", "Overall silhouette and embroidery impact"),
    shot("lehenga-detail", "Embroidery", "macro-push", 1.5, "front", "Close-up of embellishment craftsmanship", "lehenga-detail"),
    shot("dupatta", "Dupatta", "horizontal-slide", 1.5, "front", "Dupatta drape and matching detail"),
    shot("skirt", "Skirt", "tilt-down", 1.5, "front", "Skirt volume, border, hem detail"),
    shot("back", "Back Full", "slow-pull-out", 2, "back", "Back design and silhouette closure"),
  ],
};

const KURTI: Storyboard = {
  categoryKey: "kurti",
  label: "Kurti / Kurta",
  totalDurationSec: 6,
  shots: [
    shot("front", "Front Full", "slow-push-in", 2, "front", "Overall length, fit, pattern"),
    shot("design", "Neckline", "tilt-up", 1.5, "front", "Neckline design and sleeve detail", "design"),
    shot("fabric", "Fabric", "macro-push", 1, "front", "Fabric texture, weave, print fidelity"),
    shot("back", "Back Full", "detail-reveal", 1.5, "back", "Back design"),
  ],
};

const SHIRT: Storyboard = {
  categoryKey: "shirt",
  label: "Shirt",
  totalDurationSec: 6,
  shots: [
    shot("front", "Front Full", "slow-push-in", 1.5, "front", "Overall fit and styling"),
    shot("collar", "Collar", "macro-push", 1, "front", "Collar shape and stitching"),
    shot("design", "Button Line", "tilt-down", 1, "front", "Placket, button spacing, fabric drape", "design"),
    shot("fabric", "Fabric", "perspective-shift", 1, "front", "Fabric texture and weave at angle"),
    shot("back", "Back Full", "slow-pull-out", 1.5, "back", "Back fit, yoke, vent detail"),
  ],
};

const DRESS: Storyboard = {
  categoryKey: "dress",
  label: "Dress",
  totalDurationSec: 6.5,
  shots: [
    shot("front", "Front Full", "slow-push-in", 2, "front", "Silhouette, length, pattern"),
    shot("design", "Bodice", "tilt-up", 1.5, "front", "Neckline, sleeve, upper construction", "design"),
    shot("fabric", "Detail", "macro-push", 1, "front", "Fabric or embellishment close-up"),
    shot("back", "Back Full", "slow-pull-out", 2, "back", "Back design, closure, silhouette"),
  ],
};

const JACKET: Storyboard = {
  categoryKey: "jacket",
  label: "Jacket / Blazer",
  totalDurationSec: 7,
  shots: [
    shot("front", "Front Full", "slight-orbit", 2.5, "front", "Shoulder structure, lapels, fit"),
    shot("lapel", "Lapel", "macro-push", 1, "front", "Lapel shape, fabric, buttonhole"),
    shot("fabric", "Texture", "perspective-shift", 1.5, "front", "Fabric weave and surface under light"),
    shot("back", "Back Full", "slow-pull-out", 2, "back", "Back panel, vent, shoulder line"),
  ],
};

const TROUSER: Storyboard = {
  categoryKey: "trouser",
  label: "Jeans / Trousers",
  totalDurationSec: 5,
  shots: [
    shot("front", "Front Full", "tilt-down", 2, "front", "Waist, leg line, break at ankle"),
    shot("fabric", "Fabric", "macro-push", 1, "front", "Denim wash, weave, distressing"),
    shot("back", "Back Full", "slow-pull-out", 2, "back", "Back pocket, yoke, seat fit"),
  ],
};

const FOOTWEAR: Storyboard = {
  categoryKey: "footwear",
  label: "Shoes / Footwear",
  totalDurationSec: 6,
  shots: [
    shot("front", "45° Profile", "slight-orbit", 2, "front", "Hero angle — shape, profile, design"),
    shot("side", "Side", "horizontal-slide", 1.5, "front", "Full side profile, heel height"),
    shot("material", "Material", "macro-push", 1, "front", "Leather grain, stitching, texture"),
    shot("sole", "Sole", "tilt-down", 1.5, "front", "Sole construction and tread"),
  ],
};

const HANDBAG: Storyboard = {
  categoryKey: "handbag",
  label: "Handbag / Clutch",
  totalDurationSec: 6,
  shots: [
    shot("front", "Front", "slow-push-in", 2, "front", "Overall shape, closure, proportion"),
    shot("hardware", "Hardware", "macro-push", 1, "front", "Clasp, zipper, buckle quality"),
    shot("texture", "Texture", "perspective-shift", 1.5, "front", "Material surface under light"),
    shot("handle", "Handle", "tilt-up", 1.5, "front", "Handle or strap construction"),
  ],
};

const JEWELLERY: Storyboard = {
  categoryKey: "jewellery",
  label: "Jewellery",
  totalDurationSec: 7,
  shots: [
    shot("front", "Hero", "slow-push-in", 2, "front", "Full piece in premium lighting"),
    shot("detail", "Detail", "macro-push", 1.5, "front", "Stone setting, metalwork, engraving"),
    shot("shimmer", "Shimmer", "perspective-shift", 1.5, "front", "Light play across facets / surface"),
    shot("reveal", "Reveal", "detail-reveal", 2, "front", "Widening from detail to full piece"),
  ],
};

const DUPATTA: Storyboard = {
  categoryKey: "dupatta",
  label: "Dupatta",
  totalDurationSec: 5,
  shots: [
    shot("front", "Draped", "diagonal-slide", 2, "front", "Overall drape, color, pattern"),
    shot("border", "Border", "horizontal-slide", 1.5, "front", "Border detail and craftsmanship"),
    shot("fabric", "Texture", "macro-push", 1.5, "front", "Fabric weave, embroidery, surface"),
  ],
};

const ACCESSORY: Storyboard = {
  categoryKey: "accessory",
  label: "Accessories",
  totalDurationSec: 5,
  shots: [
    shot("front", "Full", "cinematic-drift", 2, "front", "Complete item in context"),
    shot("pattern", "Pattern", "macro-push", 1.5, "front", "Pattern, weave, print fidelity"),
    shot("detail", "Detail", "perspective-shift", 1.5, "front", "Material quality under light"),
  ],
};

// ── Default (front + back) ──────────────────────────────────────────────

const DEFAULT: Storyboard = {
  categoryKey: "default",
  label: "Default",
  totalDurationSec: 5,
  shots: [
    shot("front", "Front Full", "slow-push-in", 2, "front", "Overall garment presentation"),
    shot("design", "Design Detail", "macro-push", 1, "front", "Close-up detail", "design"),
    shot("back", "Back Full", "slow-pull-out", 2, "back", "Back view"),
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

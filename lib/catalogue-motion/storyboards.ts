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
// Every garment-on-model category (saree, lehenga, kurti, shirt, dress,
// jacket, trouser) is now built entirely from ai-motion shots, each at
// Veo's 4s duration floor — so a category's total video length is always
// shot-count x 4s. There is no free pan-zoom tier for these categories
// anymore: a tight crop on one garment region (pallu, collar, lapel…) gets
// real camera movement AND the model held static except for one shot's
// intentional garment motion, not a deterministic zoom on a static image.
//
// heroShot → the full front/back base image, uncropped. Establishes/closes
//   the sequence (Push In to open, Pull Out to close).
// focusShot → a tight crop on one region (crop-templates.ts), still
//   ai-motion. `motionEmphasis` is set only for the shot where garment
//   motion (not camera motion) is the actual subject, e.g. the pallu.
//
// detailShot (still pan-zoom, zero AI cost) is kept for the object-only
// categories below (footwear, handbags, jewellery, dupatta, accessories) —
// there's no model in those, so AI motion has nothing to add.

const AI_SHOT_SEC = 4; // Veo's duration floor — every ai-motion shot targets this exactly, no waste.

function heroShot(
  view: string,
  label: string,
  presetId: string,
  sourceBase: "front" | "back",
  rationale: string,
): StoryboardShot {
  return { view, label, presetId, durationSec: AI_SHOT_SEC, sourceBase, renderMode: "ai-motion", rationale };
}

function focusShot(
  view: string,
  label: string,
  presetId: string,
  sourceBase: "front" | "back",
  cropId: string,
  rationale: string,
  motionEmphasis?: string,
): StoryboardShot {
  return { view, label, presetId, durationSec: AI_SHOT_SEC, sourceBase, cropId, renderMode: "ai-motion", rationale, motionEmphasis };
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

const GENTLE_SWAY =
  "this shot's focus is the fabric's own gentle movement — let the edge visibly settle and sway, " +
  "as if a light indoor breeze is moving it. Noticeably more motion than other shots, but still slow " +
  "and soft — never a flare, swing, or dramatic flutter.";

// ── Category storyboards ────────────────────────────────────────────────

const SAREE: Storyboard = {
  categoryKey: "saree",
  label: "Saree",
  totalDurationSec: 5 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front Drape", "slow-push-in", "front", "Establish overall drape, color, and pattern before going tight"),
    focusShot("blouse", "Blouse & Neckline", "macro-push", "front", "blouse", "Embroidery and neckline detail needs proximity, not travel"),
    focusShot("pallu", "Pallu", "diagonal-slide", "back", "pallu", "Follows the pallu's natural diagonal fall line", GENTLE_SWAY),
    focusShot("pleats", "Pleats", "tilt-down", "front", "pleats", "Reveals pleat structure top-to-bottom"),
    heroShot("back", "Back Drape", "slow-pull-out", "back", "Closes the sequence, mirrors the opening shot"),
  ],
};

const LEHENGA: Storyboard = {
  categoryKey: "lehenga",
  label: "Lehenga",
  totalDurationSec: 5 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front Silhouette", "slow-push-in", "front", "Establish silhouette and embroidery impact"),
    focusShot("blouse", "Blouse & Embroidery", "macro-push", "front", "blouse", "Close-up of embellishment craftsmanship"),
    focusShot("dupatta", "Dupatta", "diagonal-slide", "front", "dupatta", "Follows the dupatta's diagonal drape across the shoulder", GENTLE_SWAY),
    focusShot("skirt", "Skirt", "tilt-down", "front", "lehenga-detail", "Skirt volume, border, and hem detail"),
    heroShot("back", "Back Silhouette", "slow-pull-out", "back", "Closes the sequence, back design and silhouette"),
  ],
};

const KURTI: Storyboard = {
  categoryKey: "kurti",
  label: "Kurti / Kurta",
  totalDurationSec: 4 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "slow-push-in", "front", "Overall length, fit, and pattern"),
    focusShot("neckline", "Neckline", "tilt-up", "front", "neckline", "Neckline design and sleeve detail"),
    focusShot("fabric", "Fabric", "macro-push", "front", "fabric", "Fabric texture, weave, and print fidelity"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back design"),
  ],
};

const SHIRT: Storyboard = {
  categoryKey: "shirt",
  label: "Shirt",
  totalDurationSec: 4 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "slow-push-in", "front", "Overall fit and styling"),
    focusShot("collar", "Collar", "macro-push", "front", "collar", "Collar shape and stitching"),
    focusShot("placket", "Placket", "tilt-down", "front", "placket", "Button spacing and fabric drape along the placket"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back fit and yoke"),
  ],
};

const DRESS: Storyboard = {
  categoryKey: "dress",
  label: "Dress",
  totalDurationSec: 4 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "slow-push-in", "front", "Silhouette, length, and pattern"),
    focusShot("bodice", "Bodice", "tilt-up", "front", "bodice", "Neckline, sleeve, and upper construction"),
    focusShot("detail", "Detail", "macro-push", "front", "detail", "Fabric or embellishment close-up"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back design and closure"),
  ],
};

const JACKET: Storyboard = {
  categoryKey: "jacket",
  label: "Jacket / Blazer",
  totalDurationSec: 4 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "slow-push-in", "front", "Shoulder structure, lapels, and fit"),
    focusShot("lapel", "Lapel", "macro-push", "front", "lapel", "Lapel shape, fabric, and buttonhole"),
    focusShot("texture", "Texture", "perspective-shift", "front", "texture", "Fabric weave and surface under light"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back panel and shoulder line"),
  ],
};

const TROUSER: Storyboard = {
  categoryKey: "trouser",
  label: "Jeans / Trousers",
  totalDurationSec: 3 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "tilt-down", "front", "Waist, leg line, and break at ankle"),
    focusShot("fabric", "Fabric", "macro-push", "front", "fabric", "Denim wash, weave, and distressing"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back pocket and seat fit"),
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
// Fallback for any category not explicitly mapped below. Most likely a
// worn garment (the object-only categories are all explicitly named), so
// this follows the same all-ai-motion pattern as the garment categories
// above, at the lightest tier (3 shots, matching Trouser).

const DEFAULT: Storyboard = {
  categoryKey: "default",
  label: "Default",
  totalDurationSec: 3 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "slow-push-in", "front", "Overall garment presentation"),
    focusShot("design", "Design Detail", "macro-push", "front", "design", "Close-up detail"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back view"),
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

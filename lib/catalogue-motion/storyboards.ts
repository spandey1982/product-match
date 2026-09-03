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
// Garment-on-model categories (saree, lehenga, kurti, shirt, dress, jacket,
// trouser) now mix render modes per shot, not one mode for the whole
// category: real AI motion is reserved for the two things it's actually
// needed for — the full front/back hero shots, and the rare shot per
// category where garment motion (not camera motion) IS the subject (pallu,
// dupatta swaying). Every purely textural/detail crop (blouse, neckline,
// fabric, collar, lapel…) renders via the same deterministic pan-zoom used
// by the object-only categories below — Veo's AI-hallucinated motion was
// found to distort fine embroidery/print patterns on exactly these shots
// (confirmed live), and a static pan/zoom over the real photo can't distort
// anything by construction. This reverses part of an earlier all-ai-motion
// redesign for these categories, keeping the parts that were right (real
// motion on hero shots and true-motion shots) and undoing the part that
// wasn't (spending Veo on shots where pixel fidelity, not movement, is what
// matters).
//
// heroShot → the full front/back base image, uncropped, ai-motion.
//   Establishes/closes the sequence (Push In to open, Pull Out to close).
// focusShot → a tight crop on one region (crop-templates.ts), ai-motion.
//   Used ONLY where motionEmphasis is set — the shot exists specifically to
//   show real garment motion, which pan-zoom structurally cannot produce.
// detailShot → a tight crop, pan-zoom (zero AI cost, zero distortion risk).
//   Used for every other crop — the point of these shots is proximity/
//   fidelity to a real detail, not motion, so AI generation adds nothing a
//   deterministic camera move over the real pixels doesn't already give for
//   free. Also the sole builder for the object-only categories below
//   (footwear, handbags, jewellery, dupatta, accessories) — no model in
//   frame there, so AI motion never had anything to add.

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
    detailShot("blouse", "Blouse & Neckline", "macro-push", AI_SHOT_SEC, "front", "Embroidery and neckline detail needs proximity and pixel fidelity, not AI-hallucinated travel", "blouse"),
    focusShot("pallu", "Pallu", "diagonal-slide", "back", "pallu", "Follows the pallu's natural diagonal fall line", GENTLE_SWAY),
    detailShot("pleats", "Pleats", "tilt-down", AI_SHOT_SEC, "front", "Reveals pleat structure top-to-bottom", "pleats"),
    heroShot("back", "Back Drape", "slow-pull-out", "back", "Closes the sequence, mirrors the opening shot"),
  ],
};

const LEHENGA: Storyboard = {
  categoryKey: "lehenga",
  label: "Lehenga",
  totalDurationSec: 5 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front Silhouette", "slow-push-in", "front", "Establish silhouette and embroidery impact"),
    detailShot("blouse", "Blouse & Embroidery", "macro-push", AI_SHOT_SEC, "front", "Close-up of embellishment craftsmanship, real pixel fidelity", "blouse"),
    focusShot("dupatta", "Dupatta", "diagonal-slide", "front", "dupatta", "Follows the dupatta's diagonal drape across the shoulder", GENTLE_SWAY),
    detailShot("skirt", "Skirt", "tilt-down", AI_SHOT_SEC, "front", "Skirt volume, border, and hem detail", "lehenga-detail"),
    heroShot("back", "Back Silhouette", "slow-pull-out", "back", "Closes the sequence, back design and silhouette"),
  ],
};

const KURTI: Storyboard = {
  categoryKey: "kurti",
  label: "Kurti / Kurta",
  totalDurationSec: 4 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "slow-push-in", "front", "Overall length, fit, and pattern"),
    detailShot("neckline", "Neckline", "tilt-up", AI_SHOT_SEC, "front", "Neckline design and sleeve detail", "neckline"),
    detailShot("fabric", "Fabric", "macro-push", AI_SHOT_SEC, "front", "Fabric texture, weave, and print fidelity", "fabric"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back design"),
  ],
};

const SHIRT: Storyboard = {
  categoryKey: "shirt",
  label: "Shirt",
  totalDurationSec: 4 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "slow-push-in", "front", "Overall fit and styling"),
    detailShot("collar", "Collar", "macro-push", AI_SHOT_SEC, "front", "Collar shape and stitching", "collar"),
    detailShot("placket", "Placket", "tilt-down", AI_SHOT_SEC, "front", "Button spacing and fabric drape along the placket", "placket"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back fit and yoke"),
  ],
};

const DRESS: Storyboard = {
  categoryKey: "dress",
  label: "Dress",
  totalDurationSec: 4 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "slow-push-in", "front", "Silhouette, length, and pattern"),
    detailShot("bodice", "Bodice", "tilt-up", AI_SHOT_SEC, "front", "Neckline, sleeve, and upper construction", "bodice"),
    detailShot("detail", "Detail", "macro-push", AI_SHOT_SEC, "front", "Fabric or embellishment close-up", "detail"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back design and closure"),
  ],
};

const JACKET: Storyboard = {
  categoryKey: "jacket",
  label: "Jacket / Blazer",
  totalDurationSec: 4 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "slow-push-in", "front", "Shoulder structure, lapels, and fit"),
    detailShot("lapel", "Lapel", "macro-push", AI_SHOT_SEC, "front", "Lapel shape, fabric, and buttonhole", "lapel"),
    detailShot("texture", "Texture", "perspective-shift", AI_SHOT_SEC, "front", "Fabric weave and surface under light", "texture"),
    heroShot("back", "Back", "slow-pull-out", "back", "Closes the sequence, back panel and shoulder line"),
  ],
};

const TROUSER: Storyboard = {
  categoryKey: "trouser",
  label: "Jeans / Trousers",
  totalDurationSec: 3 * AI_SHOT_SEC,
  shots: [
    heroShot("front", "Front", "tilt-down", "front", "Waist, leg line, and break at ankle"),
    detailShot("fabric", "Fabric", "macro-push", AI_SHOT_SEC, "front", "Denim wash, weave, and distressing", "fabric"),
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
    detailShot("design", "Design Detail", "macro-push", AI_SHOT_SEC, "front", "Close-up detail", "design"),
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

/**
 * Per-category image card configuration.
 *
 * Each category defines a PRIMARY card (the main product photo used for metadata
 * extraction + generation) and zero-or-more OTHER cards — fixed detail/part
 * shots. By default the "other" images are extraction-only (they enrich the
 * detail/GI notes, not the generator). EXCEPTION: when region image
 * conditioning is enabled (see `genReferencesFor` + ENABLE_REGION_CONDITIONING),
 * the slots mapped in `GEN_REFERENCES` ARE sent to the generator as labelled
 * visual references. Pure data + lookups; safe to import on client and server.
 */
export interface PartSlot {
  id: string;
  label: string;
}

export interface CategorySlots {
  /** Label for the primary/main card (always card 0). */
  main: string;
  /** Additional fixed cards for this category. */
  others: PartSlot[];
}

const DEFAULT_SLOTS: CategorySlots = { main: "Main image", others: [] };

/** Garments whose only extra is a single back shot. */
function frontBack(mainLabel = "Front"): CategorySlots {
  return { main: mainLabel, others: [{ id: "back", label: "Back" }] };
}

const CATEGORY_SLOTS: Record<string, CategorySlots> = {
  saree: {
    main: "Main",
    others: [
      { id: "pallu", label: "Pallu" },
      { id: "border", label: "Border" },
      { id: "blouse-front", label: "Blouse Front" },
      { id: "blouse-back", label: "Blouse Back" },
    ],
  },
  lehenga: {
    main: "Lehenga / Long skirt",
    others: [
      { id: "choli-front", label: "Choli / Blouse Front" },
      { id: "choli-back", label: "Choli / Blouse Back" },
      { id: "dupatta", label: "Dupatta" },
    ],
  },
  kurta: {
    main: "Kurta Front",
    others: [
      { id: "kurta-back", label: "Kurta Back" },
      { id: "salwar", label: "Salwar / Pyjama" },
    ],
  },
  kurti: {
    main: "Kurti Front",
    others: [
      { id: "kurta-back", label: "Back" },
      { id: "salwar", label: "Salwar / Pyjama" },
    ],
  },
  salwar: {
    main: "Salwar",
    others: [
      { id: "kurta-front", label: "Kurta Front" },
      { id: "kurta-back", label: "Kurta Back" },
    ],
  },
  suit: {
    main: "Coat Front",
    others: [
      { id: "coat-back", label: "Coat Back" },
      { id: "trouser-front", label: "Trouser Front" },
      { id: "trouser-back", label: "Trouser Back" },
      { id: "waistcoat-front", label: "Waistcoat Front" },
    ],
  },
  blouse: frontBack(),
  shirt: frontBack(),
  tshirt: frontBack(),
  waistcoat: frontBack(),
  trouser: frontBack(),
  jeans: frontBack(),
  tie: { main: "Front", others: [] },
  dupatta: { main: "Front", others: [] },
};

function normalize(category: string | null | undefined): string {
  return (category ?? "").toLowerCase().replace(/[\s_-]/g, "");
}

/** Full card config (main + others) for a category. */
export function categorySlotsFor(category: string | null | undefined): CategorySlots {
  return CATEGORY_SLOTS[normalize(category)] ?? DEFAULT_SLOTS;
}

/** Just the "other" (extraction-only) slots for a category. */
export function partSlotsFor(category: string | null | undefined): PartSlot[] {
  return categorySlotsFor(category).others;
}

// ── Catalogue card stack (R2) ────────────────────────────────────────────────
// The ORDERED display cards per category, and where each card's image comes
// from. Pure data; the resolver (lib/model-gen/catalogue-cards.ts) turns this +
// the uploaded part images + the generated base shots into final card URLs.
//   ai-base    → a generated base shot (front/back), rendered at 3:4.
//   model-crop → a crop of a generated base (a detail that exists only on the
//                model, e.g. saree pleats); `cropId` indexes crop-templates.
//   upload     → the retailer's uploaded image for `slot`, lightly enhanced
//                (non-AI). Falls back to `fallbackCropId` (a base crop) if the
//                upload is missing.

export type CardSourceKind = "ai-base" | "model-crop" | "upload";

export interface CatalogueCard {
  /** Stored on ProductImage.view; the display key. */
  id: string;
  label: string;
  kind: CardSourceKind;
  /** ai-base: which base shot. */
  base?: "front" | "back";
  /** model-crop: source base + crop-template region id. */
  cropFrom?: "front" | "back";
  cropId?: string;
  /** upload: which upload slot id ("main" or an `others` slot). */
  slot?: string;
  /** upload: base-crop region to fall back to when the upload is absent. */
  fallbackCropId?: string;
}

const AI_FRONT: CatalogueCard = { id: "front", label: "Front", kind: "ai-base", base: "front" };
const AI_BACK: CatalogueCard = { id: "back", label: "Back", kind: "ai-base", base: "back" };
const FRONT_BACK_ONLY: CatalogueCard[] = [AI_FRONT, AI_BACK];

const CARD_STACK: Record<string, CatalogueCard[]> = {
  saree: [
    AI_FRONT,
    AI_BACK,
    { id: "border", label: "Border", kind: "upload", slot: "border" },
    { id: "pallu", label: "Pallu", kind: "upload", slot: "pallu", fallbackCropId: "pallu" },
    { id: "pleats", label: "Pleats", kind: "model-crop", cropFrom: "front", cropId: "pleats" },
    { id: "blouse", label: "Blouse", kind: "upload", slot: "blouse-front", fallbackCropId: "blouse" },
  ],
  lehenga: [
    AI_FRONT,
    AI_BACK,
    { id: "lehenga", label: "Lehenga", kind: "upload", slot: "main", fallbackCropId: "lehenga-detail" },
    { id: "choli-front", label: "Choli Front", kind: "upload", slot: "choli-front", fallbackCropId: "blouse" },
    { id: "choli-back", label: "Choli Back", kind: "upload", slot: "choli-back" },
    { id: "dupatta", label: "Dupatta", kind: "upload", slot: "dupatta" },
  ],
  kurta: [
    AI_FRONT,
    AI_BACK,
    { id: "salwar", label: "Salwar", kind: "model-crop", cropFrom: "front", cropId: "salwar" },
  ],
  kurti: [
    AI_FRONT,
    AI_BACK,
    { id: "salwar", label: "Salwar", kind: "model-crop", cropFrom: "front", cropId: "salwar" },
  ],
  blouse: FRONT_BACK_ONLY,
  shirt: FRONT_BACK_ONLY,
  tshirt: FRONT_BACK_ONLY,
  waistcoat: FRONT_BACK_ONLY,
  trouser: FRONT_BACK_ONLY,
  jeans: FRONT_BACK_ONLY,
  suit: FRONT_BACK_ONLY,
};

/** The ordered catalogue card stack for a category (front/back fallback). */
export function catalogueCardsFor(category: string | null | undefined): CatalogueCard[] {
  return CARD_STACK[normalize(category)] ?? FRONT_BACK_ONLY;
}

export interface PartImage {
  slot: string;
  label: string;
  url: string;
}

/**
 * The uploaded part that shows the BACK of the product, if any (blouse-back,
 * kurta-back, coat-back, …). Single source of truth for "which upload is the
 * back" — used by both the generation engine (back-view source image) and
 * garment intelligence (back analysis input).
 */
export function findBackPart(parts: PartImage[]): PartImage | null {
  return parts.find((p) => /back/i.test(p.slot) || /back/i.test(p.label)) ?? null;
}

// ── Region conditioning references (R&D — image conditioning) ────────────────
// Which uploaded part slots are fed to the IMAGE GENERATOR as visual references
// (not just to detail/GI analysis), so the model reproduces a region from real
// PIXELS instead of only a text description. Two roles:
//   layout  → a whole-part shot teaching a distinctive region's design/placement
//             (fixes "pallu missing / wrong").
//   texture → a close-up teaching stitch-level surface/relief (fixes the flat,
//             "2D print" look on heavy work).
// Retailer-labelled uploads are GROUND TRUTH for which region is which — far
// more reliable than the vision model guessing part identity from one flat-lay.

export interface GenReference {
  /** Upload slot id this reference comes from (matches `others[].id`). */
  slot: string;
  role: "layout" | "texture";
  /** Prompt-facing name of the region. */
  label: string;
  /** Where the generator must reproduce it, in drape terms. */
  placement: string;
  /** Which base views this reference informs. */
  views: Array<"front" | "back">;
}

const GEN_REFERENCES: Record<string, GenReference[]> = {
  saree: [
    { slot: "pallu",  role: "layout",  label: "the pallu (decorative saree end-piece)", placement: "the pallu draped over the shoulder and cascading down", views: ["front", "back"] },
    { slot: "border", role: "texture", label: "the saree border",                        placement: "the border running along every edge of the saree",     views: ["front", "back"] },
  ],
  lehenga: [
    { slot: "choli-front", role: "layout",  label: "the choli / blouse front", placement: "the blouse worn on the upper body", views: ["front"] },
    { slot: "dupatta",     role: "texture", label: "the dupatta",              placement: "the draped dupatta",                 views: ["front", "back"] },
  ],
};

/**
 * Ordered generation references for a category + base view, capped at 2 to keep
 * per-generation token cost bounded ("necessary but minimum"). Empty for
 * categories without distinctive region uploads.
 */
export function genReferencesFor(
  category: string | null | undefined,
  view: "front" | "back"
): GenReference[] {
  const all = GEN_REFERENCES[normalize(category)] ?? [];
  return all.filter((r) => r.views.includes(view)).slice(0, 2);
}

/** Parse the stored partImages JSON to a typed array (never throws). */
export function parsePartImages(raw: string | null | undefined): PartImage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.url === "string")
      .map((p) => ({ slot: String(p.slot ?? ""), label: String(p.label ?? ""), url: String(p.url) }));
  } catch {
    return [];
  }
}

/**
 * Per-category image card configuration.
 *
 * Each category defines a PRIMARY card (the main product photo used for metadata
 * extraction + generation) and zero-or-more OTHER cards — fixed detail/part
 * shots. The "other" images are EXTRACTION-ONLY: they enrich the generation
 * prompt (added to the one-time detail extraction) but are never sent to the
 * image generator, so generation token cost is unchanged. Pure data + lookups;
 * safe to import on client and server.
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

export interface PartImage {
  slot: string;
  label: string;
  url: string;
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

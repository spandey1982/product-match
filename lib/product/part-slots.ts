/**
 * Category-specific optional detail close-up slots.
 *
 * These are EXTRACTION-ONLY reference shots: the retailer can upload close-ups of
 * a product's distinct, detail-dense zones (a saree's pallu/border/blouse, a
 * lehenga's skirt/dupatta, …). They're fed to the detail extractor to enrich the
 * generation prompt — never sent to the image generator — so generation token
 * cost is unchanged. Pure data + a lookup; safe to import on client and server.
 */
export interface PartSlot {
  id: string;
  label: string;
  hint: string;
}

const PART_SLOTS: Record<string, PartSlot[]> = {
  saree: [
    { id: "pallu", label: "Pallu", hint: "Decorative end worn over the shoulder" },
    { id: "border", label: "Border", hint: "Zari / edge detailing" },
    { id: "blouse", label: "Blouse", hint: "The blouse piece" },
  ],
  lehenga: [
    { id: "skirt", label: "Skirt", hint: "Flared bottom + its border/work" },
    { id: "blouse", label: "Blouse / Choli", hint: "The top piece" },
    { id: "dupatta", label: "Dupatta", hint: "The drape" },
  ],
  sharara: [
    { id: "skirt", label: "Flared legs", hint: "The flared bottom + its work" },
    { id: "blouse", label: "Blouse / Top", hint: "The top piece" },
    { id: "dupatta", label: "Dupatta", hint: "The drape" },
  ],
  suit: [
    { id: "trouser", label: "Trouser", hint: "The bottom piece" },
    { id: "waistcoat", label: "Waistcoat", hint: "The waistcoat, if any" },
  ],
};

/** Optional detail-close-up slots for a category (empty when none defined). */
export function partSlotsFor(category: string | null | undefined): PartSlot[] {
  return PART_SLOTS[(category ?? "").trim().toLowerCase()] ?? [];
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

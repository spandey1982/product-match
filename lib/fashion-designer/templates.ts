/**
 * Garment Template registry — structured construction blueprints for Fabric Flow.
 *
 * Each template is an internal construction blueprint (collar geometry, button
 * placement, pocket placement, sleeve construction, silhouette) plus a small
 * set of structured fields the retailer picks from. Structured selections are
 * the primary source of truth fed to the planner — never left to free-text
 * prompting. See lib/fashion-designer/agents/plannerAgent.ts.
 *
 * Pure data + lookups; safe to import on client and server. Keep the library
 * intentionally small (Phase 1: Shirt, Trouser, Men Suit) — expand per-category
 * over time without touching this shape.
 */

export interface TemplateFieldOption {
  value: string;
  label: string;
  /** Short visual description fed to the image-generation prompt — a style
   * name alone (e.g. "French Cuff") isn't enough for the model to render it
   * correctly; this spells out what it actually looks like. */
  visualHint?: string;
}

export interface TemplateField {
  key: string;
  label: string;
  options: TemplateFieldOption[];
  default: string;
}

export interface GarmentTemplate {
  id: string;
  /** Matches the garmentType value from NewDesignView's GARMENT_TYPES list. */
  garmentCategory: string;
  label: string;
  /** Construction blueprint — fed to the planner as authoritative ground truth. */
  blueprint: string;
  fields: TemplateField[];
}

const SHIRT_FIELDS: TemplateField[] = [
  {
    key: "sleeveLength", label: "Sleeve Length", default: "full",
    options: [
      { value: "full", label: "Full Sleeve" },
      { value: "half", label: "Half Sleeve" },
      { value: "three-quarter", label: "Three-Quarter Sleeve" },
    ],
  },
  {
    key: "collarStyle", label: "Collar Style", default: "spread",
    options: [
      { value: "spread", label: "Spread Collar", visualHint: "collar points spread wide apart, moderate spread angle" },
      { value: "button-down", label: "Button-Down Collar", visualHint: "collar points fastened flat to the shirt front with small buttons" },
      { value: "mandarin", label: "Mandarin Collar", visualHint: "short standing band collar with no points, doesn't fold down" },
      { value: "cutaway", label: "Cutaway Collar", visualHint: "collar points spread very wide, almost horizontal" },
      { value: "club", label: "Club Collar", visualHint: "collar points rounded off, no sharp corners" },
    ],
  },
  {
    key: "pocketOption", label: "Pocket", default: "single",
    options: [
      { value: "none", label: "No Pocket", visualHint: "no chest pocket of any kind" },
      { value: "single", label: "Single Chest Pocket", visualHint: "one patch pocket on the left chest" },
      { value: "double-flap", label: "Double Flap Pocket", visualHint: "two patch pockets with buttoned flaps, one on each side of the chest" },
    ],
  },
  {
    key: "cuffStyle", label: "Cuff Style", default: "barrel",
    options: [
      { value: "barrel", label: "Barrel Cuff", visualHint: "single rectangular cuff fastened with one button, no fold" },
      { value: "french", label: "French Cuff", visualHint: "a doubled-back (folded-over) cuff with no buttons, meant to be fastened with cufflinks — must be clearly visible at the wrist, folded back on itself" },
      { value: "button-two", label: "Button-Two Cuff", visualHint: "rectangular cuff fastened with two buttons side by side" },
    ],
  },
];

const TROUSER_FIELDS: TemplateField[] = [
  {
    key: "waistRise", label: "Waist Rise", default: "mid",
    options: [
      { value: "mid", label: "Mid-Rise" },
      { value: "high", label: "High-Rise" },
    ],
  },
  {
    key: "pleats", label: "Pleats", default: "flat-front",
    options: [
      { value: "flat-front", label: "Flat Front" },
      { value: "single-pleat", label: "Single Pleat" },
      { value: "double-pleat", label: "Double Pleat" },
    ],
  },
  {
    key: "pocketOption", label: "Pocket", default: "slant-side",
    options: [
      { value: "slant-side", label: "Slant Side Pockets" },
      { value: "on-seam", label: "On-Seam Pockets" },
      { value: "welt-back", label: "Welt Back Pockets" },
    ],
  },
  {
    key: "hemStyle", label: "Hem Style", default: "plain",
    options: [
      { value: "plain", label: "Plain Hem" },
      { value: "cuffed", label: "Cuffed Hem" },
    ],
  },
];

const SUIT_FIELDS: TemplateField[] = [
  {
    key: "lapelStyle", label: "Lapel Style", default: "notch",
    options: [
      { value: "notch", label: "Notch Lapel" },
      { value: "peak", label: "Peak Lapel" },
    ],
  },
  {
    key: "buttonStance", label: "Button Stance", default: "two-button",
    options: [
      { value: "two-button", label: "Single-Breasted, 2-Button" },
      { value: "three-button", label: "Single-Breasted, 3-Button" },
      { value: "double-breasted", label: "Double-Breasted" },
    ],
  },
  {
    key: "ventStyle", label: "Vent Style", default: "center",
    options: [
      { value: "center", label: "Center Vent" },
      { value: "side", label: "Side Vents" },
      { value: "none", label: "No Vent" },
    ],
  },
  {
    key: "trouserPleats", label: "Trouser Pleats", default: "flat-front",
    options: [
      { value: "flat-front", label: "Flat Front" },
      { value: "single-pleat", label: "Single Pleat" },
    ],
  },
];

export const GARMENT_TEMPLATES: GarmentTemplate[] = [
  {
    id: "shirt-classic-regular",
    garmentCategory: "Shirt",
    label: "Classic Regular Fit",
    blueprint:
      "Regular fit dress shirt. Straight silhouette with moderate ease through the chest and waist (no tapering darts). Yoke seam across the upper back, box pleat at center back for movement. Front placket with matching buttons, side seams straight from armhole to hem, shirttail hem (curved, slightly longer at back). Shoulder seams set at the natural shoulder point.",
    fields: SHIRT_FIELDS,
  },
  {
    id: "shirt-slim-fit",
    garmentCategory: "Shirt",
    label: "Slim Fit",
    blueprint:
      "Slim fit dress shirt. Tapered silhouette with side and back darts for a close body line through the chest, waist and back. Split back yoke (no center pleat) for a cleaner fit. Front placket with matching buttons, shorter and straighter side seams, shirttail hem. Narrower shoulder seams for a trimmer shoulder line.",
    fields: SHIRT_FIELDS,
  },
  {
    id: "trouser-regular-fit",
    garmentCategory: "Trouser",
    label: "Regular Fit",
    blueprint:
      "Regular fit trouser. Straight leg from seat to hem with moderate ease through the thigh, no tapering. Waistband with belt loops, standard fly-front zip closure. Front pockets slanted at the hip seam, back pockets set with besom (welt) construction. Straight side seams, single-needle topstitching.",
    fields: TROUSER_FIELDS,
  },
  {
    id: "trouser-slim-fit",
    garmentCategory: "Trouser",
    label: "Slim Fit",
    blueprint:
      "Slim fit trouser. Tapered leg from thigh to hem for a close line, fitted through the seat. Waistband with belt loops, standard fly-front zip closure. Front pockets slanted at the hip seam, back pockets set with besom (welt) construction. Narrower leg opening than regular fit.",
    fields: TROUSER_FIELDS,
  },
  {
    id: "suit-classic-two-piece",
    garmentCategory: "Men Suit",
    label: "Classic Two-piece Business Suit",
    blueprint:
      "Classic two-piece business suit: tailored jacket + matching trouser, same fabric throughout. Jacket: structured shoulder with light padding, fitted through the waist with front darts, jacket length to mid-seat. Two front besom pockets with flaps, welt breast pocket. Structured drape (half-canvas construction), not fused-flat. Trouser: matches jacket fabric exactly, straight leg, waistband with belt loops, slant front pockets, besom back pockets.",
    fields: SUIT_FIELDS,
  },
];

export function templatesForCategory(garmentType: string | null | undefined): GarmentTemplate[] {
  return GARMENT_TEMPLATES.filter((t) => t.garmentCategory === garmentType);
}

export function findTemplate(templateId: string | null | undefined): GarmentTemplate | null {
  if (!templateId) return null;
  return GARMENT_TEMPLATES.find((t) => t.id === templateId) ?? null;
}

/** Default structured-option values for a template (used until the retailer overrides a field). */
export function defaultOptionsFor(template: GarmentTemplate): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of template.fields) out[f.key] = f.default;
  return out;
}

/** Human-readable label for a field's selected value (falls back to the raw value). */
export function fieldOptionLabel(field: TemplateField, value: string): string {
  return field.options.find((o) => o.value === value)?.label ?? value;
}

/** Visual description for a field's selected value, when authored — undefined otherwise. */
export function fieldOptionVisualHint(field: TemplateField, value: string): string | undefined {
  return field.options.find((o) => o.value === value)?.visualHint;
}

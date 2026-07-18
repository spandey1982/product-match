/**
 * AI Casting metadata schema — the "casting brief" a Signature Model stores
 * and AI Casting fills in per product.
 *
 * Every appearance/style axis here is nullable, on purpose: an unset field
 * means "smart-pick at generation time" (see resolveCasting in
 * casting-match.ts). Setting a field is an explicit user override. This is
 * the same pattern as `Product.detailNotes` (opt-in enrichment) but applied
 * to persona/appearance instead of garment specifics.
 *
 * The registry-first design keeps the surface small and additive: a new axis
 * is added here first, wired into the smart-pick + prompt-refinement layer,
 * then optionally surfaced in Model Studio. Legacy rows keep working because
 * every parse falls back to null.
 */

/**
 * Maximum active Signature Models per retailer. Configs cost nothing to
 * store, but a bounded set keeps the Add Product dropdown scannable and the
 * Model Studio gallery readable. Editing an existing profile is always
 * allowed at the cap; only new-create is blocked. Deleting a profile
 * (soft-delete) frees a slot immediately. Lives here (not casting.ts) so
 * both server (createModelProfile) and client (ModelStudioView) can import
 * it without pulling the Prisma client into the client bundle.
 */
export const MAX_SIGNATURE_MODELS = 5;

/**
 * How much pose freedom the generation is allowed. Persisted on ModelProfile
 * (Signature Models) and defaulted to "studio" for AI Casting.
 *
 * - "studio"    — pose is locked by the variant reference (catalogue-safe;
 *                 same person, same pose, category over category).
 * - "editorial" — variant reference is dropped; the AI chooses pose from
 *                 occasion + persona (varied, magazine-style).
 *
 * The mode only affects HOW references are assembled at generation time; it
 * never changes output aspect ratio, resolution, cropping or branding.
 */
export type PoseMode = "studio" | "editorial";

export function isPoseMode(v: unknown): v is PoseMode {
  return v === "studio" || v === "editorial";
}

/** Realistic tones for the current Indian market. No exaggerated palette. */
export type SkinTone = "fair" | "wheatish" | "medium" | "deep";
export const SKIN_TONES: readonly SkinTone[] = ["fair", "wheatish", "medium", "deep"];

export type HairStyle =
  | "short"
  | "medium"
  | "long"
  | "wavy"
  | "styled"
  | "braided"
  | "bun";
export const HAIR_STYLES: readonly HairStyle[] = [
  "short", "medium", "long", "wavy", "styled", "braided", "bun",
];

export type HairColor =
  | "black"
  | "dark-brown"
  | "brown"
  | "auburn"
  | "highlighted";
export const HAIR_COLORS: readonly HairColor[] = [
  "black", "dark-brown", "brown", "auburn", "highlighted",
];

export type Expression =
  | "neutral"
  | "warm"
  | "confident"
  | "soft-smile"
  | "serious";
export const EXPRESSIONS: readonly Expression[] = [
  "neutral", "warm", "confident", "soft-smile", "serious",
];

/**
 * Prompt-refined only at MVP — no dedicated body-type reference. Adding one
 * later is a face-library-style change (new files under public/reference-models/
 * plus a mapping) with no schema impact.
 */
export type BodyType = "slim" | "regular" | "athletic" | "curvy" | "plus";
export const BODY_TYPES: readonly BodyType[] = [
  "slim", "regular", "athletic", "curvy", "plus",
];

export type AgeGroup = "youth" | "adult" | "mature";
export const AGE_GROUPS: readonly AgeGroup[] = ["youth", "adult", "mature"];

/**
 * Persona bundles are metadata *defaults*: picking one fills the un-set
 * appearance/style fields on save (never overwrites user-set values). This
 * keeps Model Studio short — a bridal-focused retailer picks "Luxury Bridal"
 * and the form is mostly done.
 */
export type Persona =
  | "urban-minimal"
  | "luxury-bridal"
  | "heritage-traditional"
  | "professional-formal"
  | "youth-casual";
export const PERSONAS: readonly Persona[] = [
  "urban-minimal", "luxury-bridal", "heritage-traditional",
  "professional-formal", "youth-casual",
];

/**
 * Per-persona appearance/style defaults. Applied ONLY to fields the retailer
 * has left on "Smart pick" — an explicit user choice is never overwritten.
 * The Model Studio "Apply defaults" button surfaces this behaviour; the
 * resolver's smart-pick layer uses the same values as a runtime fallback.
 */
export interface PersonaDefaults {
  hairStyle: HairStyle;
  hairColor: HairColor;
  expression: Expression;
  bodyType: BodyType;
  styleTags: string[];
}

export const PERSONA_DEFAULTS: Record<Persona, PersonaDefaults> = {
  "luxury-bridal": {
    hairStyle: "styled",
    hairColor: "dark-brown",
    expression: "soft-smile",
    bodyType: "regular",
    styleTags: ["bridal", "opulent", "heritage"],
  },
  "heritage-traditional": {
    hairStyle: "long",
    hairColor: "black",
    expression: "warm",
    bodyType: "regular",
    styleTags: ["traditional", "heritage", "ethnic"],
  },
  "professional-formal": {
    hairStyle: "medium",
    hairColor: "dark-brown",
    expression: "confident",
    bodyType: "regular",
    styleTags: ["formal", "office"],
  },
  "youth-casual": {
    hairStyle: "wavy",
    hairColor: "brown",
    expression: "warm",
    bodyType: "regular",
    styleTags: ["casual", "youth"],
  },
  "urban-minimal": {
    hairStyle: "medium",
    hairColor: "dark-brown",
    expression: "neutral",
    bodyType: "regular",
    styleTags: ["minimal", "urban"],
  },
};

/**
 * Common style-tag chips surfaced in Model Studio. Freeform strings are still
 * legal on the wire — this is UX scaffolding, not a hard whitelist — but a
 * curated set keeps Signature Models comparable across retailers so the
 * scorer's jaccard overlap actually matches.
 */
export const COMMON_STYLE_TAGS: readonly string[] = [
  "bridal", "heritage", "traditional", "ethnic", "opulent", "festive",
  "formal", "office", "minimal", "urban", "casual", "youth", "streetwear",
];

/**
 * Common product categories a Signature Model can be flagged as "best for".
 * Matches the CATEGORIES list on the upload page (kept in sync manually — a
 * shared source of truth is a Phase E cleanup, not a Phase D unlock).
 */
export const COMMON_CATEGORIES: readonly string[] = [
  "Saree", "Lehenga", "Blouse", "Dupatta", "Kurta", "Kurti",
  "Salwar", "Anarkali", "Sharara", "Palazzo",
  "Suit", "Shirt", "T-shirt", "Waistcoat", "Trouser", "Jeans",
];

// ── The brief ───────────────────────────────────────────────────────────────

/**
 * Nullable everywhere: null = "let AI Casting smart-pick this per product".
 * A Signature Model with every field null = "pin only my face, decide the
 * rest each time" — a valid, common configuration.
 *
 * `styleTags` and `categoryAffinity` are string arrays because they compose
 * with product data; freeform strings intentionally so the taxonomy can grow
 * without a migration.
 */
export interface CastingMetadata {
  skinTone: SkinTone | null;
  hairStyle: HairStyle | null;
  hairColor: HairColor | null;
  expression: Expression | null;
  bodyType: BodyType | null;
  ageGroup: AgeGroup | null;
  persona: Persona | null;
  styleTags: string[] | null;
  /** Bias the casting scorer toward products in these categories. */
  categoryAffinity: string[] | null;
}

export const EMPTY_METADATA: CastingMetadata = {
  skinTone: null,
  hairStyle: null,
  hairColor: null,
  expression: null,
  bodyType: null,
  ageGroup: null,
  persona: null,
  styleTags: null,
  categoryAffinity: null,
};

// ── Parse / serialize ───────────────────────────────────────────────────────

function inEnum<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

function stringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const arr = v.filter((x): x is string => typeof x === "string" && x.length > 0);
  return arr.length > 0 ? arr : null;
}

/**
 * Parse a stored casting metadata JSON string. Never throws — unknown /
 * malformed rows collapse to EMPTY_METADATA so the resolver still runs.
 * Unknown enum values fall back to null (smart-pick) rather than the raw
 * string, so the prompt layer never sees garbage.
 */
export function parseCastingMetadata(raw: string | null | undefined): CastingMetadata {
  if (!raw) return { ...EMPTY_METADATA };
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      skinTone:   inEnum(p.skinTone,   SKIN_TONES),
      hairStyle:  inEnum(p.hairStyle,  HAIR_STYLES),
      hairColor:  inEnum(p.hairColor,  HAIR_COLORS),
      expression: inEnum(p.expression, EXPRESSIONS),
      bodyType:   inEnum(p.bodyType,   BODY_TYPES),
      ageGroup:   inEnum(p.ageGroup,   AGE_GROUPS),
      persona:    inEnum(p.persona,    PERSONAS),
      styleTags:        stringArray(p.styleTags),
      categoryAffinity: stringArray(p.categoryAffinity),
    };
  } catch {
    return { ...EMPTY_METADATA };
  }
}

export function serializeCastingMetadata(m: CastingMetadata): string {
  return JSON.stringify(m);
}

// ── Resolved brief (post smart-pick) ────────────────────────────────────────

/**
 * The post-resolution brief passed to the prompt-refinement layer. Every
 * appearance axis is non-null (smart-pick has filled the gaps). `styleTags`
 * and `categoryAffinity` may still be empty arrays — that means "no override,
 * inherit whatever the product carries".
 */
export interface ResolvedCastingMetadata {
  skinTone: SkinTone;
  hairStyle: HairStyle;
  hairColor: HairColor;
  expression: Expression;
  bodyType: BodyType;
  ageGroup: AgeGroup;
  persona: Persona;
  styleTags: string[];
  categoryAffinity: string[];
}

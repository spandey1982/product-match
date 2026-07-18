/**
 * AI Casting — deterministic face selection + smart-pick metadata resolution.
 *
 * Mirrors backdrop-match.ts in spirit: pure, deterministic, cost-free (no AI
 * calls), and explainable via a short reason string. `resolveCasting` is the
 * single entry point — it wraps the legacy `resolveModelType` gate so callers
 * that don't opt into Signature Models still get the same modelType/variant
 * the engine uses today, plus a face id when Casting can apply.
 *
 * Casting only applies to ADULT products (woman/man). Kids continue to flow
 * through the legacy girl/boy variant refs — the face library is adult-only
 * by design, and children need a different reference workflow that is out of
 * scope for this milestone.
 */
import type { ModelType } from "./reference-models";
import { resolveModelType } from "./model-selection";
import { resolveReferenceVariant, DEFAULT_VARIANT } from "./reference-selection";
import type { ModelVariant } from "./reference-models";
import {
  FACE_LIBRARY,
  facesForSex,
  getFace,
  type FaceEntry,
  type FaceRegion,
  type FaceSex,
} from "./faces";
import {
  EMPTY_METADATA,
  type CastingMetadata,
  type Expression,
  type HairColor,
  type HairStyle,
  type Persona,
  type PoseMode,
  type ResolvedCastingMetadata,
  type SkinTone,
} from "./casting-types";

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * The subset of Product fields the casting resolver reads. Deliberately not
 * Prisma's Product type — keeps this module free of DB coupling and testable
 * with plain objects. Callers deserialize array columns via lib/serialize.ts
 * before handing off (mirrors the pattern in strategies/*).
 */
export interface CastingProductSignals {
  id?: string;
  category: string | null;
  gender: string | null;
  color: string | null;
  colors?: string[];
  occasion?: string[];
  styleTags?: string[];
  pattern?: string | null;
}

/**
 * The saved brief a Signature Model contributes. `null` = AI Casting (no
 * profile chosen at Add Product time); the resolver picks the face and every
 * metadata axis from scratch.
 */
export interface CastingProfileInput {
  id: string;
  faceId: string;
  metadata: CastingMetadata;
  poseMode: PoseMode | null;
}

export interface CastingResult {
  // ── Legacy-compatible axes (drop-in for the existing engine path) ──
  modelType: ModelType;
  variant: ModelVariant;

  // ── Face-decoupled axes (new; null when Casting does not apply) ──
  /**
   * The chosen face-library entry, or null when Casting cannot apply — kids
   * products, or an unknown profile.faceId that failed validation. Null means
   * "engine, use the legacy fused variant ref exactly as before".
   */
  face: FaceEntry | null;

  /**
   * Fully-resolved casting brief (every axis non-null after smart-pick). This
   * is what the prompt-refinement layer consumes. Populated whenever `face`
   * is non-null; when `face` is null the brief is still filled with sensible
   * defaults so downstream code stays typed.
   */
  metadata: ResolvedCastingMetadata;

  /** Studio (default) or Editorial. Studio pins pose to the variant ref. */
  poseMode: PoseMode;

  /** The Signature Model that produced this result, or null for AI Casting. */
  profileId: string | null;

  /** Short human-readable rationale — for explainability + AI-review logs. */
  reason: string;
}

export interface ResolveCastingInput {
  product: CastingProductSignals;
  /** Falls back here when the product gives no sex signal (mirrors legacy). */
  fallbackModelType: ModelType;
  /** null = AI Casting (auto-pick). A profile object = Signature Model path. */
  profile?: CastingProfileInput | null;
  /**
   * Retailer's active Signature Models — used ONLY when `profile` is null.
   * The resolver first scores these against the product (category affinity,
   * style-tag overlap, persona alignment) and picks the best if it clears
   * the threshold; otherwise falls through to face-library auto-pick. Empty
   * or absent → straight face-library auto-pick (current behaviour).
   */
  retailerProfiles?: CastingProfileInput[];
}

// ── Kid detection ───────────────────────────────────────────────────────────

function isKidModelType(mt: ModelType): boolean {
  return mt === "girl" || mt === "boy";
}

function modelTypeToSex(mt: ModelType): FaceSex | null {
  if (mt === "woman") return "female";
  if (mt === "man") return "male";
  return null; // girl/boy — Casting does not apply
}

// ── Smart-pick resolvers ────────────────────────────────────────────────────
//
// Each takes only what it needs (face region, product signals) and returns a
// concrete value. Deterministic and side-effect-free so the same product +
// face always resolves to the same brief across runs.

/**
 * Baseline realistic tone for the face's region. This is a *default*: a
 * Signature Model can override it, and even with no override we prefer the
 * region's most representative tone over guessing from garment colour.
 */
function pickSkinTone(region: FaceRegion): SkinTone {
  switch (region) {
    case "north":      return "wheatish";
    case "west":       return "wheatish";
    case "south":      return "medium";
    case "east":       return "medium";
    case "north-east": return "medium";
    case "global":     return "fair";
  }
}

function pickHairColor(region: FaceRegion): HairColor {
  return region === "global" ? "brown" : "dark-brown";
}

function pickHairStyle(persona: Persona): HairStyle {
  switch (persona) {
    case "luxury-bridal":         return "styled";
    case "heritage-traditional":  return "long";
    case "professional-formal":   return "medium";
    case "youth-casual":          return "wavy";
    case "urban-minimal":         return "medium";
  }
}

function pickExpression(persona: Persona): Expression {
  switch (persona) {
    case "luxury-bridal":         return "soft-smile";
    case "heritage-traditional":  return "warm";
    case "professional-formal":   return "confident";
    case "youth-casual":          return "warm";
    case "urban-minimal":         return "neutral";
  }
}

/**
 * Infer a persona from garment signals. Deterministic keyword matching —
 * category is the strongest signal, occasion refines, style tags disambiguate.
 * Unknown → "urban-minimal" (safe, contemporary default).
 */
function pickPersona(product: CastingProductSignals): Persona {
  const category = (product.category ?? "").trim().toLowerCase();
  const occasion = (product.occasion ?? []).map((o) => o.toLowerCase());
  const styleTags = (product.styleTags ?? []).map((s) => s.toLowerCase());

  const hasAny = (needles: string[], hay: string[]): boolean =>
    needles.some((n) => hay.includes(n));

  // Bridal / wedding cluster — highest specificity.
  if (
    hasAny(["wedding", "bridal", "reception"], occasion) ||
    hasAny(["bridal", "wedding", "bride"], styleTags) ||
    category === "lehenga" ||
    category === "sharara"
  ) {
    return "luxury-bridal";
  }

  // Traditional festive.
  if (
    hasAny(["festive", "puja", "diwali", "navratri"], occasion) ||
    hasAny(["traditional", "heritage", "ethnic"], styleTags) ||
    category === "saree"
  ) {
    return "heritage-traditional";
  }

  // Professional / formal.
  if (
    hasAny(["formal", "office", "work", "corporate"], occasion) ||
    hasAny(["formal", "office"], styleTags) ||
    category === "suit" ||
    category === "blazer"
  ) {
    return "professional-formal";
  }

  // Casual youth.
  if (
    hasAny(["casual", "daily", "party"], occasion) ||
    hasAny(["casual", "youth", "streetwear"], styleTags)
  ) {
    return "youth-casual";
  }

  return "urban-minimal";
}

/**
 * Resolve the casting brief: fill every null field via smart-pick, pass
 * user-set values through unchanged. Order matters — persona is computed
 * first because hair/expression depend on it.
 */
function smartFill(
  raw: CastingMetadata,
  face: FaceEntry,
  product: CastingProductSignals
): ResolvedCastingMetadata {
  const persona: Persona = raw.persona ?? pickPersona(product);
  return {
    skinTone:   raw.skinTone   ?? pickSkinTone(face.region),
    hairStyle:  raw.hairStyle  ?? pickHairStyle(persona),
    hairColor:  raw.hairColor  ?? pickHairColor(face.region),
    expression: raw.expression ?? pickExpression(persona),
    bodyType:   raw.bodyType   ?? "regular",
    ageGroup:   raw.ageGroup   ?? "adult",
    persona,
    styleTags:        raw.styleTags        ?? (product.styleTags ?? []),
    categoryAffinity: raw.categoryAffinity ?? [],
  };
}

// ── Auto face picker (AI Casting mode) ──────────────────────────────────────

/**
 * Regional style-tag hints — a small deterministic bias that steers the auto
 * picker toward a face whose region matches obviously regional garments. Not
 * exhaustive on purpose: the auto picker's job is a *sensible* default, not a
 * cultural encyclopaedia. Retailers who need a specific look save a Signature
 * Model.
 */
const REGION_HINTS: Record<FaceRegion, string[]> = {
  north:      ["punjabi", "delhi", "phulkari", "chikankari", "lucknowi"],
  south:      ["kanjivaram", "kanchipuram", "chennai", "bengaluru", "mysore", "silk", "temple"],
  east:       ["banarasi", "kolkata", "bengal", "tant", "jamdani"],
  west:       ["bandhani", "gujarati", "rajasthani", "kutch", "mumbai", "gota"],
  "north-east": ["assamese", "muga", "eri", "mekhela"],
  global:     [],
};

function regionAffinity(product: CastingProductSignals, region: FaceRegion): number {
  const hints = REGION_HINTS[region];
  if (hints.length === 0) return 0;
  const hay = [
    (product.category ?? "").toLowerCase(),
    (product.pattern ?? "").toLowerCase(),
    ...(product.styleTags ?? []).map((s) => s.toLowerCase()),
    ...(product.colors ?? []).map((c) => c.toLowerCase()),
  ];
  return hints.some((h) => hay.some((s) => s.includes(h))) ? 1 : 0;
}

/**
 * Deterministic hash — used to break ties without picking the same face for
 * every product in a catalogue. Same product always maps to the same face,
 * which is what retailers expect ("re-running yields the same output"), but
 * across a batch the picks distribute.
 */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface AutoPickResult {
  face: FaceEntry;
  reason: string;
}

function autoPickFace(product: CastingProductSignals, sex: FaceSex): AutoPickResult {
  const candidates = facesForSex(sex);
  // Score each candidate — currently just regional affinity; the shape is set
  // up for more axes (color harmony vs skin tone, occasion, persona) in a
  // later phase without changing callers.
  const scored = candidates.map((face) => ({
    face,
    score: regionAffinity(product, face.region),
  }));
  const max = Math.max(...scored.map((s) => s.score));

  // Tie-break: deterministic hash over the product id (or a stable fallback).
  const seed = product.id ?? `${product.category ?? ""}-${product.color ?? ""}`;
  const topTier = scored.filter((s) => s.score === max);
  const pick = topTier[hash(seed) % topTier.length].face;

  const reason = max > 0
    ? `Regional style match (${pick.region})`
    : "Balanced default (no regional signal)";
  return { face: pick, reason };
}

// ── Signature Model scorer (AI Casting auto-select) ────────────────────────
//
// When a retailer has saved Signature Models and picks "AI Casting" (no
// explicit profile) on Add Product, the resolver first checks whether one of
// the retailer's own profiles fits the product better than a face-library
// auto-pick. Uses only the metadata the retailer set — profiles left blank
// don't get spurious scores.

const SIG_CATEGORY_WEIGHT = 0.5;
const SIG_STYLE_WEIGHT    = 0.3;
const SIG_PERSONA_WEIGHT  = 0.2;
/**
 * Minimum aggregate score for a Signature Model to win over face-library
 * auto-pick. Deliberately conservative: if a retailer's saved profiles are
 * generic ("no metadata") we don't want to override AI Casting's regional
 * heuristics with a random pick.
 */
const SIG_MIN_SCORE = 0.3;

interface ScoredProfile {
  profile: CastingProfileInput;
  face: FaceEntry;
  score: number;
}

function scoreProfile(
  profile: CastingProfileInput,
  product: CastingProductSignals
): number {
  const meta = profile.metadata;
  let score = 0;

  // Category affinity — the strongest signal a retailer can give ("this model
  // is for sarees"). Case-insensitive match.
  if (meta.categoryAffinity && meta.categoryAffinity.length > 0 && product.category) {
    const pc = product.category.toLowerCase();
    if (meta.categoryAffinity.some((c) => c.toLowerCase() === pc)) {
      score += SIG_CATEGORY_WEIGHT;
    }
  }

  // Style-tag overlap — jaccard over the two tag sets. No product tags → no
  // signal (score contribution stays 0 rather than a false zero).
  if (meta.styleTags && meta.styleTags.length > 0) {
    const productTags = new Set((product.styleTags ?? []).map((s) => s.toLowerCase()));
    if (productTags.size > 0) {
      const modelTags = new Set(meta.styleTags.map((s) => s.toLowerCase()));
      const overlap = [...modelTags].filter((t) => productTags.has(t)).length;
      const union = new Set([...productTags, ...modelTags]).size;
      score += SIG_STYLE_WEIGHT * (overlap / union);
    }
  }

  // Persona alignment — profile persona matches the inferred product persona.
  if (meta.persona) {
    if (meta.persona === pickPersona(product)) {
      score += SIG_PERSONA_WEIGHT;
    }
  }

  return score;
}

function pickBestProfile(
  profiles: CastingProfileInput[],
  product: CastingProductSignals,
  sex: FaceSex
): ScoredProfile | null {
  if (profiles.length === 0) return null;
  const eligible: ScoredProfile[] = [];
  for (const profile of profiles) {
    const face = getFace(profile.faceId);
    // Sex gate: never propose a female Signature Model for a menswear
    // product (or vice versa) even if the retailer somehow saved one.
    if (!face || face.sex !== sex) continue;
    eligible.push({ profile, face, score: scoreProfile(profile, product) });
  }
  if (eligible.length === 0) return null;
  // Sort by score desc; stable order across ties (first-declared wins) is fine
  // because retailer input order (newest-first in the DB) is already meaningful.
  eligible.sort((a, b) => b.score - a.score);
  const best = eligible[0];
  return best.score >= SIG_MIN_SCORE ? best : null;
}

// ── Main entry point ────────────────────────────────────────────────────────

export function resolveCasting(input: ResolveCastingInput): CastingResult {
  const { product, fallbackModelType, profile } = input;

  // 1. Legacy sex/age gate — reuse exactly what the engine uses today so kids
  //    stay on the girl/boy path and adults route into Casting.
  const modelType = resolveModelType(product.category, product.gender, fallbackModelType);
  const variant   = resolveReferenceVariant(product.category);

  // 2. Kids bypass — Casting does not apply. Return legacy shape so callers
  //    can fall through to the existing variant-ref pipeline unchanged.
  if (isKidModelType(modelType)) {
    return {
      modelType,
      variant,
      face: null,
      metadata: {
        skinTone: "medium",
        hairStyle: "medium",
        hairColor: "dark-brown",
        expression: "warm",
        bodyType: "regular",
        ageGroup: "youth",
        persona: "youth-casual",
        styleTags: [],
        categoryAffinity: [],
      },
      poseMode: "studio",
      profileId: null,
      reason: "Kids product — legacy variant-ref path",
    };
  }

  const sex = modelTypeToSex(modelType);
  if (sex === null) {
    // Belt-and-braces: any future modelType outside our sex map falls back to
    // the legacy path.
    return {
      modelType, variant, face: null,
      metadata: smartFill(EMPTY_METADATA, FACE_LIBRARY[0], product),
      poseMode: "studio", profileId: null,
      reason: "Unmapped model type — legacy path",
    };
  }

  // 3. Signature Model path — validate face id against library.
  if (profile) {
    const face = getFace(profile.faceId);
    if (face && face.sex === sex) {
      return {
        modelType,
        variant,
        face,
        metadata: smartFill(profile.metadata, face, product),
        poseMode: profile.poseMode ?? "studio",
        profileId: profile.id,
        reason: `Signature Model (face: ${face.label})`,
      };
    }
    // Invalid face id or sex mismatch — fall through to auto-pick with a note.
    // Never throws; a stale profile should never break generation.
  }

  // 4. AI Casting — retailer-profile auto-select. Prefer one of the
  //    retailer's saved Signature Models when it fits the product; falls
  //    through to the face-library pick when none clear the threshold.
  if (input.retailerProfiles && input.retailerProfiles.length > 0) {
    const best = pickBestProfile(input.retailerProfiles, product, sex);
    if (best) {
      return {
        modelType,
        variant,
        face: best.face,
        metadata: smartFill(best.profile.metadata, best.face, product),
        poseMode: best.profile.poseMode ?? "studio",
        profileId: best.profile.id,
        reason: `AI Casting — Signature Model (${best.face.label}, score ${best.score.toFixed(2)})`,
      };
    }
  }

  // 5. AI Casting fallback — auto-pick from the face library, fully smart-picked brief.
  const { face, reason } = autoPickFace(product, sex);
  return {
    modelType,
    variant: variant ?? DEFAULT_VARIANT,
    face,
    metadata: smartFill(EMPTY_METADATA, face, product),
    poseMode: "studio",
    profileId: null,
    reason: `AI Casting — ${reason}`,
  };
}

/**
 * Reference Model library.
 *
 * A retailer chooses a visible store model (Woman / Man / Girl / Boy). Each
 * model has several HIDDEN variants (basic, saree, lehenga, kurti, western)
 * used internally for category-aware draping — the retailer never sees these.
 *
 * v1 assets are curated, version-controlled images under
 * public/reference-models/{type}-{variant}.{ext}. They are read server-side as
 * buffers (to feed the generation backends) and served over HTTP for UI
 * thumbnails. If a curated asset is missing the loader returns null and callers
 * degrade gracefully — generation never breaks before assets are supplied.
 *
 * Future (see docs/IMAGE_AI_ROADMAP.md): Cloudinary-hosted assets and
 * per-retailer uploadable custom reference models.
 */
import { access, readFile } from "fs/promises";
import { join } from "path";

export type ModelType = "woman" | "man" | "girl" | "boy";
export type ModelVariant = "basic" | "saree" | "lehenga" | "kurti" | "western";

export interface ModelTypeOption {
  id: ModelType;
  label: string;
  /** Public web path of the representative thumbnail shown in the picker. */
  thumbnailUrl: string;
}

/** Visible store-model options. Extend here to add future model types. */
export const MODEL_TYPES: ModelTypeOption[] = [
  { id: "woman", label: "Woman", thumbnailUrl: "/reference-models/woman-base-front.png" },
  { id: "man",   label: "Man",   thumbnailUrl: "/reference-models/man-base-front.png" },
  { id: "girl",  label: "Girl",  thumbnailUrl: "/reference-models/girl-base-front.jpg" },
  { id: "boy",   label: "Boy",   thumbnailUrl: "/reference-models/boy-base-front.jpg" },
];

export const DEFAULT_MODEL_TYPE: ModelType = "woman";

export function isModelType(v: unknown): v is ModelType {
  return v === "woman" || v === "man" || v === "girl" || v === "boy";
}

const REF_DIR = join(process.cwd(), "public", "reference-models");
// Curated assets may be supplied in any of these formats; tried in order.
const REF_EXTS = ["webp", "png", "jpg", "jpeg"] as const;
const EXT_MIME: Record<string, string> = {
  webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
};

/** Which view profile a reference represents. */
export type ReferenceProfile = "front" | "back";

export interface ReferenceImage {
  buffer: Buffer;
  mime: string;
  modelType: ModelType;
  variant: ModelVariant;
  profile: ReferenceProfile | null;
}

/**
 * Filename tokens to try for a variant, most-specific first. Curated assets may
 * name the neutral model "base" or "basic", so both are accepted.
 */
function variantTokens(variant: ModelVariant): string[] {
  if (variant === "basic") return ["basic", "base"];
  return [variant];
}

/**
 * Build the ordered list of candidate file basenames for a reference, from most
 * to least specific:
 *   {type}-{variant}-{profile}  ▸  {type}-{variant}  ▸  {type}-basic-{profile}  ▸  {type}-basic
 * Supports the front/back scheme ({type}-{variant}-{front|back}) and the legacy
 * single-image scheme ({type}-{variant}), with graceful fallback to basic.
 *
 * When `preferMasked` is true, a `-masked` suffix is tried before the plain
 * name at each level of specificity. This is used by AI Casting: when a face
 * identity reference is being sent alongside the drape ref, the face-masked
 * drape asset (produced by scripts/mask-variant-faces.ts) removes the drape
 * ref's own face so the identity ref is the sole face source. Loader falls
 * back to the unmasked asset if the masked variant hasn't shipped yet.
 */
function candidateBasenames(
  modelType: ModelType,
  variant: ModelVariant,
  profile?: ReferenceProfile,
  preferMasked = false
): string[] {
  const names: string[] = [];
  const add = (tokens: string[], withProfile: boolean) => {
    for (const t of tokens) {
      const base = withProfile && profile ? `${modelType}-${t}-${profile}` : `${modelType}-${t}`;
      if (preferMasked) names.push(`${base}-masked`);
      names.push(base);
    }
  };

  if (profile) add(variantTokens(variant), true);   // woman-saree-front[-masked]
  add(variantTokens(variant), false);                // woman-saree[-masked] (legacy single)
  if (variant !== "basic") {
    if (profile) add(variantTokens("basic"), true);  // woman-base-front[-masked]
    add(variantTokens("basic"), false);              // woman-basic[-masked]
  }
  return [...new Set(names)];
}

/**
 * Load a reference-model asset for (modelType, variant, profile). Falls back
 * from the requested profile/variant toward the neutral basic model, then
 * returns null if nothing exists yet. Never throws.
 *
 * @param opts.preferMasked  When true, the loader prefers `-masked` variants
 *   at each level of specificity — used by AI Casting so the drape reference
 *   doesn't fight the face identity reference. Gracefully falls back to the
 *   unmasked asset when a masked one hasn't shipped for that (type, variant,
 *   profile) tuple. See scripts/mask-variant-faces.ts.
 */
export async function loadReferenceImage(
  modelType: ModelType,
  variant: ModelVariant,
  opts: { profile?: ReferenceProfile; preferMasked?: boolean } = {}
): Promise<ReferenceImage | null> {
  for (const base of candidateBasenames(modelType, variant, opts.profile, opts.preferMasked)) {
    for (const ext of REF_EXTS) {
      const p = join(REF_DIR, `${base}.${ext}`);
      try {
        await access(p);
        const buffer = await readFile(p);
        return {
          buffer,
          mime: EXT_MIME[ext],
          modelType,
          variant,
          profile: opts.profile ?? null,
        };
      } catch {
        // try next extension / candidate
      }
    }
  }
  return null;
}

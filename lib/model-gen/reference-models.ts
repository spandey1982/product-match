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
  { id: "woman", label: "Woman", thumbnailUrl: "/reference-models/woman-basic.jpg" },
  { id: "man",   label: "Man",   thumbnailUrl: "/reference-models/man-basic.jpg" },
  { id: "girl",  label: "Girl",  thumbnailUrl: "/reference-models/girl-basic.jpg" },
  { id: "boy",   label: "Boy",   thumbnailUrl: "/reference-models/boy-basic.jpg" },
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

export interface ReferenceImage {
  buffer: Buffer;
  mime: string;
  modelType: ModelType;
  variant: ModelVariant;
}

/**
 * Load a reference-model asset for (modelType, variant). Falls back from the
 * requested variant to "basic", then returns null if neither exists yet.
 * Never throws.
 */
export async function loadReferenceImage(
  modelType: ModelType,
  variant: ModelVariant
): Promise<ReferenceImage | null> {
  const candidates: ModelVariant[] =
    variant === "basic" ? ["basic"] : [variant, "basic"];

  for (const v of candidates) {
    for (const ext of REF_EXTS) {
      const p = join(REF_DIR, `${modelType}-${v}.${ext}`);
      try {
        await access(p);
        const buffer = await readFile(p);
        return { buffer, mime: EXT_MIME[ext], modelType, variant: v };
      } catch {
        // try next extension / variant
      }
    }
  }
  return null;
}

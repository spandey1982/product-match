/**
 * Face reference library — the identity axis for AI Casting.
 *
 * A small, curated set of portrait references (6 regions × 2 sexes = 12). Each
 * entry is a portrait-only asset: it conditions the identity of the generated
 * model (bone structure, tonal warmth, ethnic character) but carries no drape,
 * no pose and no body. Pose/body/drape come from the existing variant reference
 * (see reference-selection.ts). This split is the whole point of AI Casting —
 * face identity stays locked across every catalogue shot while pose/drape can
 * change per category.
 *
 * This module is CLIENT-SAFE — only pure data + type-narrowing helpers. The
 * server-side asset loader lives in faces-loader.ts so `fs/promises` never
 * pollutes a client bundle (Model Studio imports FACE_LIBRARY straight into
 * a "use client" component). Registry-first: adding or removing a face is a
 * code change (deterministic, versioned) — the retailer never uploads to
 * this library. Retailer-owned Signature Models reference one of these
 * entries by id; they do not add to the library.
 */

/** India-region grouping used by the casting scorer and the Studio picker. */
export type FaceRegion =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "global";

/** Face sex — hard gate against product sex during casting. */
export type FaceSex = "female" | "male";

export interface FaceEntry {
  /** Stable id persisted on ModelProfile.faceId and generated-image metadata. */
  id: string;
  /** Retailer-facing label shown in Model Studio's face picker. */
  label: string;
  region: FaceRegion;
  sex: FaceSex;
  /** Public web path of the portrait thumbnail (Studio + gallery). */
  thumbnailUrl: string;
}

/**
 * The registry. Order here is the order Model Studio renders them; keep
 * female and male grouped for scan-ability.
 *
 * Labels are DELIBERATELY neutral ("Model 1", "Model 2", …). We source models
 * with regional inspiration for inclusivity, but the retailer-facing surface
 * treats them as fashion models first — the same way a real casting sheet
 * doesn't sort humans by region. Region is retained as *metadata* only
 * because the scorer's regionAffinity heuristic uses it to bias the
 * auto-picker (e.g. "kanjivaram" → South-inspired face). Never surfaced in
 * copy.
 */
export const FACE_LIBRARY: readonly FaceEntry[] = [
  // Female — six inspirations
  { id: "north-f-1",      label: "Model 1", region: "north",      sex: "female", thumbnailUrl: "/reference-models/faces/north-f-1.webp" },
  { id: "south-f-1",      label: "Model 2", region: "south",      sex: "female", thumbnailUrl: "/reference-models/faces/south-f-1.webp" },
  { id: "east-f-1",       label: "Model 3", region: "east",       sex: "female", thumbnailUrl: "/reference-models/faces/east-f-1.webp" },
  { id: "west-f-1",       label: "Model 4", region: "west",       sex: "female", thumbnailUrl: "/reference-models/faces/west-f-1.webp" },
  { id: "north-east-f-1", label: "Model 5", region: "north-east", sex: "female", thumbnailUrl: "/reference-models/faces/north-east-f-1.webp" },
  { id: "global-f-1",     label: "Model 6", region: "global",     sex: "female", thumbnailUrl: "/reference-models/faces/global-f-1.webp" },
  // Male — six inspirations
  { id: "north-m-1",      label: "Model 1", region: "north",      sex: "male",   thumbnailUrl: "/reference-models/faces/north-m-1.webp" },
  { id: "south-m-1",      label: "Model 2", region: "south",      sex: "male",   thumbnailUrl: "/reference-models/faces/south-m-1.webp" },
  { id: "east-m-1",       label: "Model 3", region: "east",       sex: "male",   thumbnailUrl: "/reference-models/faces/east-m-1.webp" },
  { id: "west-m-1",       label: "Model 4", region: "west",       sex: "male",   thumbnailUrl: "/reference-models/faces/west-m-1.webp" },
  { id: "north-east-m-1", label: "Model 5", region: "north-east", sex: "male",   thumbnailUrl: "/reference-models/faces/north-east-m-1.webp" },
  { id: "global-m-1",     label: "Model 6", region: "global",     sex: "male",   thumbnailUrl: "/reference-models/faces/global-m-1.webp" },
];

/** Lookup a face by id. Returns null on unknown id (never throws). */
export function getFace(id: string): FaceEntry | null {
  return FACE_LIBRARY.find((f) => f.id === id) ?? null;
}

/** Faces for a given sex — the base filter every casting query starts from. */
export function facesForSex(sex: FaceSex): FaceEntry[] {
  return FACE_LIBRARY.filter((f) => f.sex === sex);
}

export function isFaceId(v: unknown): v is string {
  return typeof v === "string" && FACE_LIBRARY.some((f) => f.id === v);
}

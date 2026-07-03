/**
 * Backdrop preset registry — the studio environment behind generated model
 * images.
 *
 * A backdrop is treated as STRUCTURED METADATA, not prose: each preset carries
 * color / lighting / gradient / floor / branding profiles that later phases
 * translate into provider-specific prompts or parameters. This keeps generation
 * prompts short, outputs consistent, and presets reusable/versionable (the
 * catalogue brief's "metadata-driven" direction).
 *
 * Phase 1 — UI chooser. Phase 2 — `renderBackdropPrompt` drives a consistent
 * studio across views. Phase 3 — Smart match scores presets per product (see
 * backdrop-match.ts) using `matchColor` / `neutral` below.
 *
 * Extensibility: new collections (seasonal, premium, retailer-custom store
 * studios) are added here as more presets with a `tier` — callers never change.
 */

export type BackdropMode = "smart" | "preset";

/** Pack a preset belongs to. "custom" (retailer store studios) is future work. */
export type BackdropTier = "core" | "seasonal" | "premium" | "custom";

/**
 * Drives the lightweight CSS-rendered studio preview — no image assets. The UI
 * composes a soft top-down light, a wall→floor sweep and a vignette from these
 * tones so a preset can be added with a few lines of metadata.
 */
export interface BackdropSwatch {
  /** Upper wall tone (top of the sweep). */
  wall: string;
  /** Lower wall tone, just above the floor transition. */
  wallDeep: string;
  /** Floor tone below the transition. */
  floor: string;
  /** rgba used for the inset vignette, tuned per hue. */
  vignette: string;
}

/** Hue/tone description — consumed by Smart match (Phase 3) and branding. */
export interface ColorProfile {
  /** Plain-language family, e.g. "warm off-white", "cool grey". */
  family: string;
  /** Neutrality 0 (very neutral) – 1 (strongly tinted). */
  saturation: number;
  /** Perceived lightness 0 (dark) – 1 (bright). Feeds Phase 4 branding. */
  brightness: number;
}

export interface LightingProfile {
  /** Diffusion 0 (hard) – 1 (very soft). */
  softness: number;
  /** Key-light direction. */
  direction: "top" | "top-left" | "top-right" | "front";
  /** Overall exposure 0 (low-key) – 1 (high-key). */
  intensity: number;
}

export interface GradientProfile {
  /** Top→bottom falloff 0 (flat) – 1 (strong). */
  falloff: number;
}

export interface FloorProfile {
  /** Wall→floor transition height, 0 (high in frame) – 1 (low). */
  transition: number;
  /** Floor reflectivity 0 (matte) – 1 (glossy). */
  reflection: number;
}

/** Logo treatment a backdrop favours — consumed in Phase 4 (adaptive branding). */
export interface BrandingHints {
  preferredLogo: "dark" | "light";
}

export interface BackdropPreset {
  /** Stable key persisted in settings (and later on generated images). */
  id: string;
  label: string;
  tier: BackdropTier;
  /** Short tag shown under the preview, e.g. "Benchmark". */
  tag?: string;
  /**
   * Garment-colour keyword (a color-harmony family) the backdrop reads as —
   * Smart match scores garment↔backdrop compatibility against this. Phase 3.
   */
  matchColor: string;
  /**
   * Neutral studios (white/beige/grey/cream) are safe, premium defaults that
   * flatter any garment; tinted studios (false) only win when they genuinely
   * complement and don't sit too close to the garment's own colour.
   */
  neutral: boolean;
  swatch: BackdropSwatch;
  color: ColorProfile;
  lighting: LightingProfile;
  gradient: GradientProfile;
  floor: FloorProfile;
  branding: BrandingHints;
}

/**
 * Core backdrop pack. Boutique Beige is the benchmark — it mirrors the soft
 * beige/off-white sweep of the internal reference models; every other preset
 * follows the same photography language (softness, density, studio lighting)
 * and differs only in color profile, never becoming a flat color fill.
 */
export const BACKDROP_PRESETS: BackdropPreset[] = [
  {
    id: "reference-studio",
    label: "Boutique Beige",
    tier: "core",
    tag: "Benchmark",
    matchColor: "beige",
    neutral: true,
    swatch: { wall: "#f1ebe1", wallDeep: "#e7dfce", floor: "#d6ccb6", vignette: "rgba(120,100,60,0.10)" },
    color: { family: "warm beige off-white", saturation: 0.18, brightness: 0.9 },
    lighting: { softness: 0.85, direction: "top", intensity: 0.78 },
    gradient: { falloff: 0.35 },
    floor: { transition: 0.72, reflection: 0.18 },
    branding: { preferredLogo: "dark" },
  },
  {
    id: "soft-white",
    label: "Soft White",
    tier: "core",
    matchColor: "white",
    neutral: true,
    swatch: { wall: "#fcfcfb", wallDeep: "#f2f1ef", floor: "#e3e2dd", vignette: "rgba(80,80,80,0.07)" },
    color: { family: "neutral soft white", saturation: 0.04, brightness: 0.97 },
    lighting: { softness: 0.9, direction: "top", intensity: 0.85 },
    gradient: { falloff: 0.28 },
    floor: { transition: 0.72, reflection: 0.2 },
    branding: { preferredLogo: "dark" },
  },
  {
    id: "stone-grey",
    label: "Stone Grey",
    tier: "core",
    matchColor: "grey",
    neutral: true,
    swatch: { wall: "#ecedef", wallDeep: "#dcdee1", floor: "#c6c8cd", vignette: "rgba(60,65,75,0.10)" },
    color: { family: "cool stone grey", saturation: 0.06, brightness: 0.84 },
    lighting: { softness: 0.82, direction: "top", intensity: 0.72 },
    gradient: { falloff: 0.4 },
    floor: { transition: 0.72, reflection: 0.16 },
    branding: { preferredLogo: "dark" },
  },
  {
    id: "mist-blue",
    label: "Mist Blue",
    tier: "core",
    matchColor: "blue",
    neutral: false,
    swatch: { wall: "#ebf0f4", wallDeep: "#d9e2ec", floor: "#c1cedd", vignette: "rgba(40,70,110,0.10)" },
    color: { family: "cool mist blue", saturation: 0.22, brightness: 0.88 },
    lighting: { softness: 0.84, direction: "top", intensity: 0.74 },
    gradient: { falloff: 0.38 },
    floor: { transition: 0.72, reflection: 0.18 },
    branding: { preferredLogo: "dark" },
  },
  {
    id: "blush-pink",
    label: "Blush Pink",
    tier: "core",
    matchColor: "pink",
    neutral: false,
    swatch: { wall: "#f9eef1", wallDeep: "#f1dde3", floor: "#e3c5cf", vignette: "rgba(120,50,75,0.09)" },
    color: { family: "warm blush pink", saturation: 0.24, brightness: 0.9 },
    lighting: { softness: 0.86, direction: "top", intensity: 0.76 },
    gradient: { falloff: 0.34 },
    floor: { transition: 0.72, reflection: 0.18 },
    branding: { preferredLogo: "dark" },
  },
  {
    id: "warm-cream",
    label: "Warm Cream",
    tier: "core",
    matchColor: "cream",
    neutral: true,
    swatch: { wall: "#f8f1e3", wallDeep: "#efe4cd", floor: "#e0cfae", vignette: "rgba(120,95,40,0.10)" },
    color: { family: "warm cream", saturation: 0.2, brightness: 0.92 },
    lighting: { softness: 0.86, direction: "top", intensity: 0.78 },
    gradient: { falloff: 0.32 },
    floor: { transition: 0.72, reflection: 0.18 },
    branding: { preferredLogo: "dark" },
  },
];

/** The benchmark preset id — the default for both Smart match and Choose. */
export const DEFAULT_BACKDROP_PRESET_ID = "reference-studio";

/** A retailer's stored backdrop choice. */
export interface BackdropSelection {
  mode: BackdropMode;
  presetId: string;
}

export const DEFAULT_BACKDROP_SELECTION: BackdropSelection = {
  mode: "smart",
  presetId: DEFAULT_BACKDROP_PRESET_ID,
};

export function isBackdropMode(v: unknown): v is BackdropMode {
  return v === "smart" || v === "preset";
}

export function isBackdropPresetId(v: unknown): v is string {
  return typeof v === "string" && BACKDROP_PRESETS.some((p) => p.id === v);
}

export function isBackdropSelection(v: unknown): v is BackdropSelection {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return isBackdropMode(o.mode) && isBackdropPresetId(o.presetId);
}

/** Parse an unknown into a valid selection, repairing/defaulting any bad field. */
export function parseBackdropSelection(raw: unknown): BackdropSelection {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      mode: isBackdropMode(o.mode) ? o.mode : DEFAULT_BACKDROP_SELECTION.mode,
      presetId: isBackdropPresetId(o.presetId)
        ? o.presetId
        : DEFAULT_BACKDROP_SELECTION.presetId,
    };
  }
  return { ...DEFAULT_BACKDROP_SELECTION };
}

export function getBackdropPreset(id: string): BackdropPreset | undefined {
  return BACKDROP_PRESETS.find((p) => p.id === id);
}

/**
 * Resolve an EXPLICIT selection to its preset. Smart-mode resolution lives in
 * backdrop-match.ts (it needs product signals); this returns the default for a
 * smart selection only as a context-free fallback.
 */
export function resolveBackdropPreset(selection: BackdropSelection): BackdropPreset {
  const id = selection.mode === "smart" ? DEFAULT_BACKDROP_PRESET_ID : selection.presetId;
  return getBackdropPreset(id) ?? BACKDROP_PRESETS[0];
}

/**
 * Translate a preset's structured profiles into a deterministic studio prompt
 * fragment — the Phase 2 replacement for the hardcoded studio string in
 * prompt-sets.ts. This is the "studio consistency" lever: because every view of
 * a generation (front, back, and the cropped close-ups derived from them) is
 * built from the SAME preset, they share one identical studio description, so
 * they read as photographed in the same room. The explicit "keep … consistent"
 * clause reinforces uniform brightness/gradient/floor/shadows per shot.
 *
 * Pure + deterministic: no AI call, same input → same string (the cost-control
 * direction). Returned as a fragment so callers append it to a view prompt.
 */
export function renderBackdropPrompt(preset: BackdropPreset): string {
  const { color, lighting, gradient, floor } = preset;

  const softness =
    lighting.softness > 0.8 ? "very soft, diffused"
    : lighting.softness > 0.6 ? "soft, diffused"
    : "controlled directional";
  const exposure =
    lighting.intensity > 0.82 ? "bright high-key exposure"
    : lighting.intensity > 0.7 ? "evenly balanced exposure"
    : "gentle low-key exposure";
  const grad =
    gradient.falloff > 0.36
      ? "a smooth top-to-bottom tonal gradient"
      : "an even, barely-there gradient";
  const reflection =
    floor.reflection > 0.18 ? "a faint, soft floor reflection" : "a matte, reflection-free floor";
  const direction = lighting.direction.replace("-", " ");

  return [
    `Set in a professional fashion e-commerce photography studio with a seamless ${color.family} backdrop`,
    `lit with ${softness} ${direction} lighting at ${exposure}`,
    `${grad} sweeping into a soft wall-to-floor transition with ${reflection}`,
    "Keep the backdrop colour, brightness, lighting, gradient, floor transition, reflections, shadows, vignette and overall studio ambience uniform and consistent",
    "High resolution, photorealistic, no text or watermark, no secondary insets or fabric swatches — exactly one continuous photograph.",
  ].join(". ");
}

/** Lightweight view the chooser UI needs (no internal profiles). */
export interface BackdropOptionView {
  id: string;
  label: string;
  tag?: string;
  swatch: BackdropSwatch;
}

export function listBackdropOptions(): BackdropOptionView[] {
  return BACKDROP_PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    tag: p.tag,
    swatch: p.swatch,
  }));
}

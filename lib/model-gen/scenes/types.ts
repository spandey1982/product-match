/**
 * Scenic Collection — structured scene definitions.
 *
 * A scene is treated as STRUCTURED METADATA, not prose, exactly like
 * `../backdrops.ts`'s `BackdropPreset`: every scene carries environment /
 * lighting / decor / depth / palette profiles that the Prompt Builder
 * (`prompt-builder.ts`) translates into one deterministic prompt fragment.
 * This keeps prompts short, outputs consistent, and scenes reusable,
 * versionable and testable — see docs/IMAGE_AI_ROADMAP.md §12.
 *
 * Studio (`../backdrops.ts`) and Scenic Collection (this module) are the two
 * peer sections of the backdrop chooser. They are structurally independent —
 * Studio never imports from here, and this module never imports Studio types
 * — but both produce the same `backdrop: string` fragment consumed by
 * `../prompt-sets.ts#buildViewPrompt`, so the engine can swap between them
 * without any downstream change.
 */

/** How prominent the environment is allowed to be. Never overrides the garment as hero. */
export type SceneIntensity = "minimal" | "balanced" | "editorial";

/** How many environmental elements populate the scene. */
export type SceneDensity = "minimal" | "classic" | "rich";

/** Time of day / lighting character — a first-class part of the scene, not an afterthought. */
export type CameraStyle =
  | "morning"
  | "golden-hour"
  | "soft-daylight"
  | "evening"
  | "night"
  | "indoor-studio"
  | "outdoor";

/**
 * Whether a scene should vary its environment across generations (seasonal /
 * festive / wedding — an identity that stays recognizable while never
 * repeating the exact same backdrop) or stay consistent (boutique / corporate
 * / retail-studio categories, where repeatability IS the brand promise).
 */
export type SceneVariationPolicy = "varies" | "consistent";

export interface DepthLayers {
  /** Nearest-camera layer — must never occlude or compete with the model. */
  foreground: string;
  /** The layer immediately behind/around the model. */
  midground: string;
  /** The furthest layer, softly out of focus. */
  background: string;
}

export interface ScenePalette {
  /** Neutral/base environment tones, always safe. */
  base: string[];
  /** Candidate accent families the colour-harmony resolver chooses between. */
  accent: string[];
  /** Colour families to avoid leaning into — usually because they're common
   *  garment colours for this occasion and would camouflage the product. */
  avoid: string[];
}

export interface SceneVariation {
  /** Stable key, e.g. "traditional-courtyard". */
  id: string;
  label: string;
  /** One-sentence environment description — the core of the prompt fragment. */
  environment: string;
  depth: DepthLayers;
  /** Decor elements, one list per density level. Every element must justify
   *  its presence in a realistic photograph — never random space-filling. */
  decor: Record<SceneDensity, string[]>;
}

export interface Scene {
  /** Stable key persisted in settings and GenerationRecord.sceneId. */
  id: string;
  label: string;
  /** Brand Pack this scene groups under in the UI, e.g. "festive". */
  brandPack: string;
  variationPolicy: SceneVariationPolicy;
  /** Allowed camera styles; index 0 is the scene's default. */
  cameraStyles: CameraStyle[];
  palette: ScenePalette;
  /** One entry when variationPolicy === "consistent"; several when "varies". */
  variations: SceneVariation[];
  /** Feeds the branding-placement fallback (mirrors BackdropPreset.branding/color.brightness). */
  brandingHint: { preferredLogo: "dark" | "light"; brightness: number };
  /**
   * Chooser chip identity — an icon + accent colour instead of a rendered
   * preview thumbnail (there's no real photo to preview against). `icon` is a
   * lucide-react component name, resolved by the UI's icon lookup map.
   */
  theme: { icon: string; color: string };
  /** Scene-specific additions to the core negative-prompt library. */
  negativeExtras?: string[];
  /** Deterministic recommendation signal — matched against Product metadata
   *  (occasion/styleTags/season enums from lib/metadata/analyze.ts). */
  recommendFor: {
    occasion?: string[];
    styleTags?: string[];
    season?: string[];
    categories?: string[];
  };
}

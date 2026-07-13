/**
 * Garment Intelligence — structured schema (R&D).
 *
 * The typed shape of "what makes this garment unique": construction, surface
 * techniques, pattern, texture and craftsmanship. Deliberately STRUCTURED
 * rather than free-form prose so the same analysis can power catalogue
 * generation today and descriptions / search / recommendations / analytics
 * later, each rendering it differently — see
 * docs/research/GARMENT_INTELLIGENCE_RND.md ("Structured vs prose").
 *
 * Values are intentionally loose strings (not enums): vision output vocabulary
 * varies, and clamping it to enums at extraction time would silently discard
 * the nuance ("shadow-work bakhiya" → "embroidery") this feature exists to
 * capture. Consumers that need enums normalize downstream.
 */

/** One surface technique observed on the garment (chikankari, zari, mirror…). */
export interface SurfaceTechnique {
  /** Technique name, e.g. "chikankari embroidery", "zari", "sequin work". */
  type: string;
  /** Physical relief above the base fabric: e.g. "flat", "low", "raised", "layered". */
  relief: string;
  /** Coverage density: e.g. "sparse", "scattered", "medium", "dense", "all-over". */
  density: string;
  /** Whether the work reads as handcrafted (vs printed/machine-flat). */
  handcrafted: boolean;
  /** Thread/embellishment colours, e.g. ["off-white", "gold"]. */
  colors: string[];
  /** Where on the garment: e.g. "all-over", "border", "yoke", "pallu". */
  placement: string;
  /** Stitch/work characteristics worth preserving, e.g. "individually visible 2-3mm running stitches". */
  stitchCharacteristics: string;
}

/** A region of the image the whole-garment pass flags for close-up analysis. */
export interface RegionOfInterest {
  /** Human label, e.g. "chest yoke embroidery", "hem border". */
  label: string;
  /** Why it deserves independent analysis. */
  reason: string;
  /** Normalized [0..1] bounding box on the analyzed image. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Deep observation of one cropped region (hierarchical pass 2). */
export interface RegionObservation {
  /** The ROI label this observation belongs to. */
  label: string;
  /** Technique seen in the crop, at close range. */
  technique: string;
  /** Relief as judged from the close-up (more reliable than whole-image). */
  relief: string;
  /** Stitch/texture specifics visible only at this scale. */
  detail: string;
  /** Motif structure inside the region, e.g. "square lattice, knot-flower centers". */
  motif: string;
}

/**
 * What the BACK of the garment actually looks like (from a real back photo).
 * Exists to stop the generator's habit of copying the front design onto the
 * back — when this is absent, prompts fall back to a deterministic "plain or
 * continues the body pattern, never the front neckline/yoke" guard clause.
 */
export interface BackIntelligence {
  /** True when the back is essentially unadorned fabric. */
  plain: boolean;
  /** What is actually on the back, e.g. "continues the all-over butti pattern", "plain solid fabric". */
  design: string;
  /** Surface techniques present on the back (often fewer than the front). */
  techniques: string[];
  /** Back neckline shape/detail, e.g. "simple round back neck, no placket". */
  neckline: string;
}

export interface GarmentIntelligence {
  /** Bump when this shape changes (mirrors GarmentIntelligence.version column). */
  version: 2;

  /** "How is the garment built" — silhouette/structure, not surface. */
  construction: {
    silhouette: string;
    /**
     * Precise hem level in body-landmark terms — "hip-length", "mid-thigh",
     * "knee-length", "mid-shin"… Generation-critical: there is no universal
     * kurta/kurti length, and generations routinely invent one.
     */
    length: string;
    neckline: string;
    /**
     * Precise sleeve length — "sleeveless", "cap", "half", "elbow-length",
     * "three-quarter", "full". Same generation-critical status as length.
     */
    sleeves: string;
    /** Notable structural details: slits, pleats, seams, closures… */
    details: string[];
  };

  /** Everything living ABOVE the base fabric. The fidelity-critical section. */
  surfaceTechniques: SurfaceTechnique[];

  pattern: {
    /** Dominant motifs, e.g. ["floral butti", "lattice"]. */
    motifs: string[];
    /** Layout across the garment, e.g. "all-over grid", "border-concentrated". */
    layout: string;
    /** Relative motif scale, e.g. "small (1-3cm)", "large statement". */
    scale: string;
  };

  texture: {
    /** Base fabric guess, e.g. "cotton", "georgette". */
    baseFabric: string;
    /** Surface finish, e.g. "matte", "silk sheen". */
    finish: string;
    /** Drape behaviour, e.g. "structured", "fluid". */
    drape: string;
  };

  /** The merchandiser's summary of the workmanship. */
  craftsmanship: {
    /** Overall embellishment weight, e.g. "heavy", "moderate", "minimal". */
    overallDensity: string;
    /** True when the surface work must read as handmade, dimensional. */
    handcrafted: boolean;
    /** The 2-4 things a buyer would notice first / a generator must not lose. */
    highlights: string[];
  };

  /** Close-up observations from the hierarchical region pass (may be empty). */
  regions: RegionObservation[];

  /** Back-image analysis when a back photo existed (null otherwise). */
  back: BackIntelligence | null;

  /** Extractor self-assessment: "high" | "medium" | "low". */
  confidence: string;
}

/** Persisted row shape handed to consumers (parsed `data` + rendered notes). */
export interface GarmentIntelligenceRecord {
  intelligence: GarmentIntelligence;
  /** Deterministically rendered prompt fragment (see render.ts). */
  promptNotes: string;
  /** Rendered BACK-view fragment; null when no back image was analyzed. */
  backPromptNotes: string | null;
  /** Vision model that produced the analysis. */
  model: string;
  analyzedImageUrl: string;
}

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
  /**
   * How the technique is physically made, e.g. "woven into the fabric
   * structure (jacquard/brocade)" vs "applied onto the surface after
   * weaving (embroidery/appliqué/stitched/stonework)". Determines whether a
   * flat photographic read is authentic (woven-in) or a fidelity loss to
   * correct for (applied-on) — a photo alone can't reliably tell the two
   * apart (see docs/research/SAREE_ANATOMY_TAXONOMY.md, construction-method
   * refinement). Empty when not determinable.
   */
  constructionMethod: string;
  /**
   * When a single motif/technique combines multiple distinct material
   * classes (e.g. metallic thread petals + a stone ring + a contrast velvet
   * centre), list each. Empty when single-material.
   */
  materialComposition: string[];
  /** True when techniques are physically stacked on top of each other (e.g. zari base, thread stitching over it, mirror discs on top of that), producing cumulative real thickness — not just one raised layer. */
  physicallyLayered: boolean;
  /** Stack-order description when physicallyLayered, e.g. "zari base layer, thread stitching over it, mirror discs set on top, stone accents on top of that". Empty when not physicallyLayered. */
  layeringNote: string;
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
  /** Construction method judged from the close-up (same vocabulary as SurfaceTechnique.constructionMethod) — the most reliable evidence point for this judgment. */
  constructionMethod: string;
  /**
   * Normalized [0..1] bounding box on the ANALYZED main image this crop was
   * taken from. Null for retailer-part-upload-sourced observations (no
   * position on the main image — it's a separate photo). Populated for
   * model-proposed ROI crops, letting generation time re-derive the same
   * crop from the stored main image without a second vision pass.
   */
  bbox: { x: number; y: number; width: number; height: number } | null;
  /** Which evidence lane produced this observation. */
  source: "upload" | "roi";
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
  version: 3;

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
    /**
     * Non-empty when embellishment colour closely matches the base fabric
     * colour — the work may be under-represented or invisible in a normal
     * photo (self-tone/low-contrast capture risk; a photo genuinely can't
     * carry evidence that isn't visible at capture resolution/contrast).
     */
    captureRisk: string;
  };

  /** Close-up observations from the hierarchical region pass (may be empty). */
  regions: RegionObservation[];

  /** Back-image analysis when a back photo existed (null otherwise). */
  back: BackIntelligence | null;

  /** Extractor self-assessment: "high" | "medium" | "low". */
  confidence: string;

  /**
   * Affirmative negative facts — things confirmed ABSENT, not merely
   * unmentioned. E.g. "no buti on the cream-coloured zone". Silence is not
   * the same as an explicit absence: a generator with no negative signal
   * will default to inventing plausible detail where none exists (every
   * other observed instance of this category tends to have it). Generalizes
   * the back-of-garment plain-back guard to any zone stated absent by
   * design. Empty for most non-saree products.
   */
  explicitAbsences: string[];

  /**
   * Saree/dupatta-specific structure (border/pallu/buti anatomy). Null for
   * every other category — this is deliberately kept out of the
   * category-generic fields above, mirroring how SAREE_DRAPE/blouseClause
   * already live as saree-only logic in lib/model-gen/prompt-sets.ts rather
   * than in the generic schema.
   */
  sareeStructure: SareeStructure | null;
}

/** One ordered sub-band within a saree border (borders are frequently a stack of distinct bands, not one motif). */
export interface SareeBorderSubBand {
  /** Stacking order, outer edge = 0. */
  order: number;
  description: string;
  /** Loose: "narrow", "broad", or a relative note. */
  width: string;
  technique: string;
}

/**
 * One of a saree's two long edges. Borders run the full length of the
 * cloth; "top"/"bottom" is geometric (stand at the pallu, face into the
 * body — right hand = top, left hand = bottom; bottom border anchors the
 * front pleats), never assumed from photo framing. The two borders are
 * never assumed symmetric in design or width.
 */
export interface SareeBorder {
  edge: "top" | "bottom" | "unspecified";
  /** Overall summary; primary field when there's no meaningful sub-band split. */
  design: string;
  /** Ordered stack; empty when the border is a single simple band. */
  subBands: SareeBorderSubBand[];
  /** Fringe/tassel/beads on THIS edge specifically; "" if none. Never assumed universal across edges. */
  edgeAddition: string;
}

/** One distinct repeating-motif population on a saree body (a saree can carry more than one, at different placements/densities/axes). */
export interface ButiPopulation {
  /** Distinguishes this population from others, e.g. "general body buti", "bottom-border-adjacent buti band". */
  label: string;
  /**
   * Free text: "all-over body", "confined to the bottom border, nowhere
   * else", "pink zone only". Also where a motif that bridges two zones
   * (e.g. a border band that physically extends inward and merges with a
   * buti population) gets described, rather than forcing it into one
   * category.
   */
  placementZone: string;
  /**
   * "discrete" = a small, self-contained repeat unit — one macro crop is
   * representative of both its design AND its texture. "continuous" = a
   * connected/flowing pattern (e.g. a trailing vine) with no single
   * repeatable unit — a macro crop here is texture evidence ONLY, never a
   * layout reference; composition authority stays with the main image.
   */
  patternType: "discrete" | "continuous";
  /**
   * Running direction relative to the pallu: "perpendicular" (spans
   * border-to-border across the width), "parallel" (runs along the length,
   * hugging one specific border), "none" (radially symmetric or otherwise
   * non-directional — carries no orientation signal).
   */
  axis: "perpendicular" | "parallel" | "none";
  motif: string;
  technique: string;
  colors: string[];
}

/** One color zone on a hard-split or zoned saree. Single entry (label "whole saree") when there's no split. */
export interface SareeColorZone {
  label: string;
  /** Loose: "solid", "gradient", "hard-split zone with internal gradient". */
  colorMechanism: string;
  colors: string[];
  /** Non-empty when this zone's border/buti differs from the saree's default design; "" when it shares the default. */
  decorativeOverrideNote: string;
}

export interface SareeStructure {
  /** Typically 2 entries (top, bottom), always described independently. */
  borders: SareeBorder[];
  /** How the pallu relates to the border design. */
  palluRelationship: "same-rotated" | "boxed-nested" | "independent" | "unknown";
  /** The pallu's own interior content, especially for boxed/nested pallus where it differs from the continuing border-frame. */
  palluContent: string;
  /** How the pallu/border motif turns the 90° corner when they share a design. Low priority — real but secondary. */
  palluCornerTreatment: string;
  /** Free text placement, e.g. "tassels at pallu end only, not on either border" — never assumed universal. */
  palluTassels: string;
  /** MULTIPLE populations, not one — a saree frequently carries more than one distinct buti population. */
  butiPopulations: ButiPopulation[];
  /** Single entry (label "whole saree") when there's no color split. */
  colorZones: SareeColorZone[];
  /** True when a hard line splits the WHOLE WIDTH into color zones at one point along the length (distinct from an ombre/gradient). */
  hardSplit: boolean;
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

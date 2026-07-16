/**
 * Category-aware catalogue prompt sets.
 *
 * A "catalogue" generation renders an ordered list of VIEWS; each view appends
 * a modifier to a shared base on-model prompt. Retailers never choose views —
 * the system derives the set from the product category. Designed data-first so
 * sets can later be admin-configurable or RAG-driven (docs/IMAGE_AI_ROADMAP.md
 * §8) without changing callers.
 */

export interface PromptView {
  /** Stored on ProductImage.view. Also used in Cloudinary tags / research log. */
  id: string;
  /** Retailer-facing label (shown under each generated image). */
  label: string;
  /** Appended to the base prompt to steer this specific shot. */
  modifier: string;
}

// Saree drape is deterministic and IDENTICAL in intent across front and back
// (only the camera side differs) — retailer testing (2026-07-15) found the
// model otherwise improvised the pallu differently per view (front bunched/
// short, back floor-length/spread). We standardize on the spread-open,
// floor-length pallu because it shows the most surface area and craftsmanship.
const SAREE_DRAPE =
  "The pallu is spread fully open and cascades straight down to floor length, displayed flat and wide with its entire design and border visible edge-to-edge — never bunched, folded, tucked or shortened. The saree is draped in a neat, elegant, presentable style that maximises the visible embroidered surface.";

const SAREE: PromptView[] = [
  { id: "front",  label: "Front View",       modifier: `Full-length front view of the draped saree. ${SAREE_DRAPE}` },
  { id: "back",   label: "Back View",        modifier: `Full-length back view of the draped saree, showing the blouse back. ${SAREE_DRAPE}` },
  { id: "pallu",  label: "Pallu Close-Up",   modifier: "Close-up of the pallu, highlighting its print, weave and embellishment in sharp focus." },
  { id: "border", label: "Border Close-Up",  modifier: "Close-up of the saree border, showing the zari and edge detailing crisply." },
];

const LEHENGA: PromptView[] = [
  { id: "front",  label: "Front View",       modifier: "Full-length front view, the lehenga skirt gently flared and the dupatta draped naturally." },
  { id: "back",   label: "Back View",        modifier: "Full-length back view showing the blouse back and the fall of the skirt." },
  { id: "blouse", label: "Blouse Close-Up",  modifier: "Close-up of the blouse, highlighting the neckline, sleeves and embellishment." },
];

const KURTI: PromptView[] = [
  { id: "front",  label: "Front View",       modifier: "Full-length front view, the kurti worn naturally with a clean silhouette." },
  { id: "back",   label: "Back View",        modifier: "Full-length back view showing the kurti's back design and fit." },
  { id: "fabric", label: "Fabric Detail",    modifier: "Close-up fabric detail, showing the texture, print and stitching." },
];

const GENERIC: PromptView[] = [
  { id: "front", label: "Front View", modifier: "Full-length front view, the product worn naturally and clearly visible." },
  { id: "back",  label: "Back View",  modifier: "Full-length back view of the product." },
];

const CATEGORY_PROMPT_SET: Record<string, PromptView[]> = {
  saree: SAREE,
  dupatta: SAREE,
  lehenga: LEHENGA,
  sharara: LEHENGA,
  kurta: KURTI,
  kurti: KURTI,
  salwar: KURTI,
  anarkali: KURTI,
};

/** Resolve the ordered view set for a category (generic front/back fallback). */
export function resolvePromptSet(category: string | null | undefined): PromptView[] {
  const key = category?.trim().toLowerCase() ?? "";
  return CATEGORY_PROMPT_SET[key] ?? GENERIC;
}

function subjectFor(gender: string): string {
  switch (gender) {
    case "MEN":   return "a well-groomed Indian man, 30 years old, confident posture";
    case "BOYS":  return "a young Indian boy with a cheerful, natural posture";
    case "GIRLS": return "a young Indian girl with a cheerful, natural posture";
    default:      return "a graceful Indian woman, 25 years old, elegant posture";
  }
}

export interface ViewPromptInput {
  category: string;
  color: string;
  gender: string;
  view: PromptView;
  /** Whether a reference-model image accompanies the request. */
  hasReference: boolean;
  /** Optional concise detail hints (prompt enrichment) to preserve fine detail. */
  detailNotes?: string | null;
  /**
   * The studio backdrop fragment (from renderBackdropPrompt). Identical across
   * every view of a generation, which is what makes the set look like one
   * studio. Required so a caller can never silently drop the backdrop.
   */
  backdrop: string;
  /**
   * Optional exact backdrop colour (hex) sampled from the FIRST shot of the set
   * (studio-anchor). When present, the view is pinned to that colour so later
   * shots match the realized studio of the first — minimal background data, not
   * the whole image.
   */
  studioAnchor?: string | null;
  /**
   * Region reference close-ups accompanying this generation (pallu, border, …),
   * in the SAME order runGeminiImageGen appends their image parts. Each is
   * enumerated in the prompt so the model reproduces that region from the real
   * photo. Empty/absent → no roll-call change (current behaviour).
   */
  extraReferences?: Array<{ label: string; placement: string }>;
}

/** "Preserve these product specifics: …" clause, or "" when no notes. */
function detailClause(detailNotes?: string | null): string {
  const notes = detailNotes?.trim();
  return notes ? `Faithfully preserve these product specifics: ${notes}.` : "";
}

/**
 * Deterministic guard for BACK views generated without any real back
 * information (no back image, no back notes). Counters the generator's
 * documented habit of duplicating the front design — neckline/yoke/placket
 * embroidery — onto an invented back: no kurta/kurti/similar garment carries
 * its front chest design on the back. Worded garment-agnostically so it
 * holds for every category with this failure mode.
 */
const BACK_FALLBACK_CLAUSE =
  "The garment's back is plain or simply continues the garment's overall body pattern — never duplicate the front neckline, yoke, placket or chest ornamentation on the back.";

/** The back guard, only for back views that have no real back notes. */
function backGuardClause(viewId: string, detailNotes?: string | null): string {
  return viewId === "back" && !detailNotes?.trim() ? BACK_FALLBACK_CLAUSE : "";
}

/**
 * A saree is worn with a SEPARATE blouse the model otherwise invents freshly
 * per view — retailer testing (2026-07-16) got a red blouse on the front and a
 * navy one on the back of the same generation. Pin the blouse deterministically
 * to the saree's own colour, worded IDENTICALLY for front and back so the two
 * independent generations agree. Derived from the product colour (no extra
 * data); only for saree-like drapes.
 */
function blouseClause(category: string, color: string): string {
  const cat = category.trim().toLowerCase();
  if (cat !== "saree" && cat !== "dupatta") return "";
  return `The saree is worn with a simple well-fitted plain ${color} blouse — keep the blouse this exact same ${color} colour and plain style identical in every view.`;
}

/**
 * Hard camera-orientation contract, appended as the LAST sentence of front
 * and back view prompts. The view modifier ("Full-length front view…") is one
 * early sentence in what is now a long prompt (detail notes + backdrop/scene
 * fragments); observed in retailer testing (2026-07-14): a Scenic
 * "editorial" front generation rendered the model from BEHIND — editorial
 * fashion language biases toward walking-away poses, and the buried modifier
 * lost. Ending the prompt with an unambiguous orientation line leverages
 * recency to make the pose non-negotiable. Deterministic, zero AI calls.
 */
function orientationClause(viewId: string): string {
  if (viewId === "front") {
    return "Camera orientation (mandatory): the model faces the camera directly, front of the garment fully visible — never shown from behind, over-the-shoulder, or walking away.";
  }
  if (viewId === "back") {
    return "Camera orientation (mandatory): the model is seen from directly behind, back of the garment fully visible.";
  }
  return "";
}

/**
 * Compose the full prompt for one view. When a reference model image is
 * supplied it is sent as the first image and the prompt instructs the model to
 * dress that exact person (improving draping consistency); otherwise a fresh
 * model is described from the product's gender. Detail hints (when present)
 * tell the model which fine specifics it must not lose during synthesis.
 */
/** "…match the backdrop colour #hex…" clause, or "" when no anchor. */
function anchorClause(studioAnchor?: string | null): string {
  const hex = studioAnchor?.trim();
  return hex
    ? `The studio backdrop colour must exactly match ${hex} from the first shot of this set, keeping one identical studio across every image.`
    : "";
}

/**
 * Enumerate region reference images starting at `startIndex`, plus the
 * same-garment guard. "" when there are none. Indices MUST match the image
 * part order runGeminiImageGen appends (model?, product, extras…).
 */
function extraImageClause(
  refs: Array<{ label: string; placement: string }> | undefined,
  startIndex: number
): string {
  if (!refs || refs.length === 0) return "";
  const lines = refs.map(
    (r, i) =>
      `Image ${startIndex + i} is a real close-up photo of ${r.label} of this exact same garment — faithfully reproduce its exact design, motif, colour and surface texture on ${r.placement}.`
  );
  lines.push(
    "These extra images are reference photos of the SAME single garment, provided ONLY so you reproduce those regions accurately on the worn garment — never display, paste, inset, tile, float or show these reference images, or any swatch, cut-out, panel or copy of them, anywhere in the output."
  );
  return lines.join(" ");
}

export function buildViewPrompt(input: ViewPromptInput): string {
  const { category, color, gender, view, hasReference, detailNotes, backdrop, studioAnchor, extraReferences } = input;
  const detail = detailClause(detailNotes);
  const backGuard = backGuardClause(view.id, detailNotes);
  const blouse = blouseClause(category, color);
  const anchor = anchorClause(studioAnchor);
  const orientation = orientationClause(view.id);
  const extraCount = extraReferences?.length ?? 0;
  // When reference close-ups are supplied, the model is prone to compositing
  // them into the frame as floating swatches/detail panels (an e-commerce
  // collage convention). This LAST-sentence guard leverages recency — the same
  // lever that made the orientation clause stick — to forbid it outright.
  const swatchGuard =
    extraCount > 0
      ? "Absolute final requirement: the output is exactly ONE continuous studio photograph of the model wearing the garment against the plain backdrop — do not render, paste, inset, float or tile any reference image, swatch, fabric cut-out or detail panel anywhere in the frame; nothing else may appear besides the model and the garment."
      : "";

  if (hasReference) {
    const total = 2 + extraCount; // model + product + extras
    return [
      `You are given ${total} images. Image 1 is the reference fashion model. Image 2 is the product garment.`,
      `Generate a photorealistic photograph of the model in Image 1 wearing this ${color} ${category} from Image 2.`,
      "Preserve the model's face, body and skin tone from Image 1, and the garment's exact colour, print and texture from Image 2.",
      extraImageClause(extraReferences, 3),
      view.modifier,
      detail,
      backGuard,
      blouse,
      backdrop,
      anchor,
      orientation,
      swatchGuard,
    ].filter(Boolean).join(" ");
  }

  return [
    `Full-body fashion photograph of ${subjectFor(gender)} wearing this ${color} ${category}.`,
    extraCount > 0 ? "Image 1 is the product garment." : "",
    extraImageClause(extraReferences, 2),
    view.modifier,
    detail,
    backGuard,
    backdrop,
    anchor,
    orientation,
    swatchGuard,
  ].filter(Boolean).join(" ");
}

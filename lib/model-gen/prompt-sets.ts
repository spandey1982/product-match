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

const SAREE: PromptView[] = [
  { id: "front",  label: "Front View",       modifier: "Full-length front view, the saree draped elegantly with the pallu visible over the shoulder." },
  { id: "back",   label: "Back View",        modifier: "Full-length back view showing the blouse back and the fall of the pallu." },
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

export function buildViewPrompt(input: ViewPromptInput): string {
  const { category, color, gender, view, hasReference, detailNotes, backdrop, studioAnchor } = input;
  const detail = detailClause(detailNotes);
  const backGuard = backGuardClause(view.id, detailNotes);
  const anchor = anchorClause(studioAnchor);

  if (hasReference) {
    return [
      "You are given two images. Image 1 is the reference fashion model. Image 2 is the product garment.",
      `Generate a photorealistic photograph of the model in Image 1 wearing this ${color} ${category} from Image 2.`,
      "Preserve the model's face, body and skin tone from Image 1, and the garment's exact colour, print and texture from Image 2.",
      view.modifier,
      detail,
      backGuard,
      backdrop,
      anchor,
    ].filter(Boolean).join(" ");
  }

  return [
    `Full-body fashion photograph of ${subjectFor(gender)} wearing this ${color} ${category}.`,
    view.modifier,
    detail,
    backGuard,
    backdrop,
    anchor,
  ].filter(Boolean).join(" ");
}

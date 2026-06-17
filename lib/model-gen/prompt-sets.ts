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

const SETTING =
  "Professional fashion e-commerce photography, soft diffused studio lighting, clean light-grey background, high resolution, photorealistic, no text or watermark.";

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
}

/**
 * Compose the full prompt for one view. When a reference model image is
 * supplied it is sent as the first image and the prompt instructs the model to
 * dress that exact person (improving draping consistency); otherwise a fresh
 * model is described from the product's gender.
 */
export function buildViewPrompt(input: ViewPromptInput): string {
  const { category, color, gender, view, hasReference } = input;

  if (hasReference) {
    return [
      "You are given two images. Image 1 is the reference fashion model. Image 2 is the product garment.",
      `Generate a photorealistic photograph of the model in Image 1 wearing this ${color} ${category} from Image 2.`,
      "Preserve the model's face, body and skin tone from Image 1, and the garment's exact colour, print and texture from Image 2.",
      view.modifier,
      SETTING,
    ].join(" ");
  }

  return [
    `Full-body fashion photograph of ${subjectFor(gender)} wearing this ${color} ${category}.`,
    view.modifier,
    SETTING,
  ].join(" ");
}

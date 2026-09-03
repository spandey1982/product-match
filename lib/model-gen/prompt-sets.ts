/**
 * Category-aware catalogue prompt sets.
 *
 * A "catalogue" generation renders an ordered list of VIEWS; each view appends
 * a modifier to a shared base on-model prompt. Retailers never choose views —
 * the system derives the set from the product category. Designed data-first so
 * sets can later be admin-configurable or RAG-driven (docs/IMAGE_AI_ROADMAP.md
 * §8) without changing callers.
 */
import { classifyFabricWeight } from "./fabric-weight";

export interface PromptView {
  /** Stored on ProductImage.view. Also used in Cloudinary tags / research log. */
  id: string;
  /** Retailer-facing label (shown under each generated image). */
  label: string;
  /** Appended to the base prompt to steer this specific shot. */
  modifier: string;
}

export const CROSS_VIEW_LABEL = "__cross_view_ref__";
/**
 * Marks a reference image sourced from Garment Intelligence's own evidence
 * (a retailer part upload or a model-proposed ROI crop, re-derived at
 * generation time — see lib/garment-intelligence/region-references.ts).
 * Unlike the generic close-up template below, these carry the FULL placement
 * instruction (zone, axis, "trust this over the crop's own framing") in
 * `placement` — text and image are deliberately split by what each is
 * reliable for: the crop for surface/relief fidelity, the accompanying
 * sentence for WHERE it goes, sourced from GI's structured data rather than
 * left for the model to infer from the photo's own incidental orientation.
 */
export const GI_REGION_LABEL = "__gi_region__";

// Saree drape is deterministic and IDENTICAL in intent across front and back
// (only the camera side differs) — retailer testing (2026-07-15) found the
// model otherwise improvised the pallu differently per view (front bunched/
// short, back floor-length/spread). We standardize on a floor-length pallu
// with its full design visible because that's what shows the most surface
// area and craftsmanship — NOT on a flat, "spread open" rendering: retailer
// testing (2026-08-09) found the earlier wording ("spread fully open...flat
// and wide...edge-to-edge") pushed the model to render a second unfurled
// sheet of fabric alongside the one already draped over the shoulder (front:
// pallu appearing twice), and a stiff, gravity-defying flat rectangle on the
// back — both a direct consequence of describing the pallu as a flat panel
// instead of real cloth. Rewritten to keep the original intent (full pallu
// visible, floor-length, never bunched/tucked/shortened, identical between
// views) while describing physically real drape.
const SAREE_DRAPE =
  "The pallu is a single continuous piece of fabric draped over one shoulder and falling to floor length, its full design and border visible along its length — never bunched, folded, tucked or shortened, and never rendered as a second or duplicate panel of fabric elsewhere on the body. It follows natural cloth physics: soft, gravity-led folds and drape, exactly one pallu per figure, never held flat, rigid or stiffly away from the body. The saree is draped in a neat, elegant, presentable style that maximises the visible embroidered surface without sacrificing realistic fabric behavior. The saree's hemline and pleats fall all the way to the floor, pooling gently at the feet and mostly covering them — the saree is never cropped or lifted to show bare ankles or shins.";

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

const BLOUSE: PromptView[] = [
  { id: "front",  label: "Front View",       modifier: "Full-length front view showing the blouse as part of a complete traditional outfit." },
  { id: "back",   label: "Back View",        modifier: "Full-length back view showing the blouse back design, neckline and embellishment as part of a complete outfit." },
];

const BOTTOM_WEAR: PromptView[] = [
  { id: "front",  label: "Front View",       modifier: "Full-length front view showing the bottom-wear product as part of a complete outfit, with the product clearly visible." },
  { id: "back",   label: "Back View",        modifier: "Full-length back view showing the bottom-wear product fit and drape as part of a complete outfit." },
];

const GENERIC: PromptView[] = [
  { id: "front", label: "Front View", modifier: "Full-length front view, the product worn naturally and clearly visible." },
  { id: "back",  label: "Back View",  modifier: "Full-length back view of the product." },
];

const CATEGORY_PROMPT_SET: Record<string, PromptView[]> = {
  saree: SAREE,
  dupatta: SAREE,
  lehenga: LEHENGA,
  sharara: BOTTOM_WEAR,
  kurta: KURTI,
  kurti: KURTI,
  salwar: BOTTOM_WEAR,
  palazzo: BOTTOM_WEAR,
  churidar: BOTTOM_WEAR,
  leggings: BOTTOM_WEAR,
  pyjama: BOTTOM_WEAR,
  blouse: BLOUSE,
  anarkali: KURTI,
};

/** Resolve the ordered view set for a category (generic front/back fallback). */
export function resolvePromptSet(category: string | null | undefined): PromptView[] {
  const key = category?.trim().toLowerCase() ?? "";
  return CATEGORY_PROMPT_SET[key] ?? GENERIC;
}

/**
 * Photorealism clause — appended near the end of every view prompt (after
 * orientation, before the swatch guard), same recency-wins position validated
 * live against production (research/why-it-looks-ai.html; scripts/
 * test-realism-revision.ts). Deliberately hedged ("without breaking any
 * camera-orientation requirement stated elsewhere") so it reads as a
 * refinement of the orientation clause above it, never a contradiction —
 * the orientation clause itself is untouched.
 *
 * Addresses (see research doc): zero skin-texture vocabulary anywhere in the
 * prompt pipeline, generic posed-smile expression, no camera/lens language,
 * no shadow-physics language, and the "authentic catalogue photography, not
 * CGI" instruction that previously existed only on the Scenic Collection
 * path (negative-prompts.ts) — now universal.
 */
const REALISM_CORE =
  "Photographic realism: natural skin with visible pore-level texture and subtle tonal variation, not airbrushed or overly smooth. Fabric drapes and falls following natural cloth physics and gravity, never rigid, stiff or held artificially away from the body. A warm, genuine smile that reaches the eyes — bright, alert, engaged eyes with a soft catchlight in both, gently crinkled corners at the eyes and naturally lifted cheeks that show the smile is real and not just the mouth (a genuine Duchenne smile), with a slight, natural asymmetry rather than a perfectly mirrored expression; never a neutral, flat, dull, bored, or disinterested expression, and never a stiff, obviously-posed grin either. Weight settled naturally onto one leg for a candid, unposed feel, without breaking any camera-orientation requirement stated elsewhere in this prompt. Shot as if on an 85mm portrait lens at a wide aperture, natural photographic depth of field separating the model from the backdrop. This must read as an authentic photograph from a real studio session, not an illustration, render, or CGI.";

/**
 * Universal lighting clause — applies to every generation regardless of
 * which backdrop system (Studio or Scenic Collection) supplies the
 * environment description. Added after competitor benchmarking
 * (karchobi.in, 2026-09) identified lighting as the single highest-leverage
 * gap: every reference photo used one clearly directional light source with
 * a visible rim-light on hair, physically consistent shadow falloff, and a
 * warm overall grade — none of which existed anywhere in this pipeline
 * before this clause (backdrops.ts described only flat top-down light with
 * a contact shadow; REALISM_CORE above had zero lighting language at all).
 * Deliberately kept independent of REALISM_CORE (skin/pose/lens) so it can
 * be isolated and re-tuned on its own.
 */
const LIGHTING_CORE =
  "Lighting: the scene is lit by one dominant, clearly directional light source — never flat, shadowless, or evenly lit from every side. That direction is visible as a soft highlight along the hair and the side of the face/body nearest the light, with a gentle falloff into shadow on the opposite side, and a shadow that falls consistently in one direction wherever the model meets the ground or backdrop. A subtle rim-light traces the edge of the hair and shoulders, separating the model crisply from the background the way a real key light does. Skin shows soft specular catch-light on its high points (cheekbones, nose bridge, collarbone), consistent with that same light direction, not uniformly matte. The overall colour grade leans warm and natural, like real daylight or a warm key light — never cold, grey, or clinically flat.";

/**
 * Universal colour-grade clause — the tonal treatment of the FINISHED
 * photograph, distinct from LIGHTING_CORE above (which describes the light
 * source itself). Grounded in a specific, previously undocumented finding
 * (research/why-it-looks-ai.html, point 10, "Photoshoot styles per setting
 * and color"): this pipeline's colour-harmony logic already picks a good
 * complementary accent colour for a scene, but nothing anywhere ever
 * instructed the actual tonal treatment of the final image. Real editorial
 * photography favours split-toning (cool-biased shadows, warm-biased
 * highlights) and a deliberately controlled, lower-saturation environment
 * palette that leaves the garment itself as the single most vivid element
 * in frame — both entirely absent from the prompt pipeline before this.
 */
const COLOR_GRADE =
  "Colour grade: apply a refined editorial colour treatment across the whole photograph — a subtle warm cast in the highlights and a slightly cooler, deeper cast in the shadows (split-toning), never one flat colour temperature applied uniformly everywhere. The environment, backdrop and any props stay in a controlled, gently muted palette — real colour, never grey or lifeless, but never as saturated or vivid as the garment itself. The garment's own colour and pattern remain the single most saturated, vivid element in the frame exactly as photographed, so the eye is drawn to the product first. Tonal range is rich, not flat or washed out — real shadow depth and highlight detail, never a uniformly bright, contrast-less exposure.";

/**
 * Fallback hand-task instruction — from India-specific photography research
 * (research/why-it-looks-ai.html, point 03, "How they carry the products"):
 * "no hand-task language exists anywhere in the prompt system... one hand is
 * almost always in service of the garment... never idle" in real fashion
 * photography. Previously only the saree-back and lehenga/sharara-front
 * cases below had any hand guidance at all — every other category, and even
 * the saree FRONT view itself, left hands completely undirected. Applied
 * wherever no more specific category+view hand instruction exists.
 */
const DEFAULT_HAND_TASK =
  "One hand rests naturally at the side or gently touches the garment's fabric, hem, or edge, as if caught in a relaxed, natural moment — never idle, rigid, clenched, or hanging awkwardly. Fingers are relaxed and naturally curved, never stiff or unnaturally splayed.";

/**
 * Category+view realism addenda, from India-specific photography research
 * (research/why-it-looks-ai.html): posture is mechanically load-bearing for
 * draped garments — an upright spine keeps pleats/pallu from visibly
 * sagging — and a hand resting near a pallu/dupatta as if just-adjusted
 * reads as candid rather than static (the "held-and-displayed" convention),
 * without touching SAREE_DRAPE's own never-bunched/duplicated constraint.
 */
function realismAddendum(category: string, viewId: string): string {
  const cat = category.trim().toLowerCase();
  if (cat === "saree" || cat === "dupatta") {
    const posture = "Spine upright, pleats hanging straight and symmetrical, unwrinkled.";
    if (viewId === "back") {
      return `${posture} The pallu falls exactly as already described — floor-length, undisturbed — but rendered as if a moment ago the model's hand adjusted it: one hand resting lightly near the pallu's edge at shoulder height, not gripping or lifting it, with a very gentle, soft natural sway at the pallu's lower edge from indoor air — never a dramatic flare or swing.`;
    }
    return `${posture} One hand rests lightly near the pallu's edge at the waist, as if just settled a moment ago — not gripping or lifting it.`;
  }
  if (cat === "lehenga" || cat === "sharara") {
    if (viewId === "front") {
      return "One hand resting lightly near the dupatta's edge at the shoulder, as if just adjusted a moment ago.";
    }
    return DEFAULT_HAND_TASK;
  }
  return DEFAULT_HAND_TASK;
}

function realismClause(category: string, viewId: string): string {
  const addendum = realismAddendum(category, viewId);
  return addendum ? `${REALISM_CORE} ${addendum}` : REALISM_CORE;
}

function subjectFor(gender: string): string {
  switch (gender) {
    case "MEN":   return "a well-groomed Indian man, 30 years old, confident posture";
    case "BOYS":  return "a young Indian boy with a cheerful, natural posture";
    case "GIRLS": return "a young Indian girl with a cheerful, natural posture";
    default:      return "a graceful Indian woman, 25 years old, elegant posture";
  }
}

/**
 * Loose-hair instruction — live-tested (2026-09) against the tied-back/bun
 * default the generator otherwise chose on its own: loose hair reads as
 * visibly livelier (catches light along its edge, moves naturally with a
 * candid head-turn) than a severe bun, which is part of what made earlier
 * generations feel dull/static. Scoped to WOMEN/GIRLS only — loose-vs-tied
 * isn't a meaningful styling axis for the short-hair descriptions men/boys
 * get in subjectFor().
 */
function hairClause(gender: string): string {
  if (gender !== "MEN" && gender !== "BOYS") {
    return "Hair worn naturally loose and flowing, falling past the shoulders and framing the face — not tied back, pulled up, or in a bun.";
  }
  return "";
}

/**
 * Fabric weight should select the pose, not just describe texture (research/
 * why-it-looks-ai.html, point 02, "The appearance with the clothing on"):
 * heavy silk holds structured pleats and calls for static, sculptural
 * posing; light georgette/chiffon "shows its most beautiful movement when
 * you walk" and calls for motion-implying poses instead. Previously nothing
 * in the pipeline connected fabric weight to posing at all — Garment
 * Intelligence's fabric-physics language is scoped strictly to the garment
 * itself, never to how it behaves ON the body. Product.material is already
 * a real, structured field (lib/metadata/analyze.ts's closed fabric list),
 * populated at upload — this reuses it rather than adding new data.
 *
 * Classification lives in fabric-weight.ts (shared with the Festive scene's
 * automatic decor density — scenes/rule-engine.ts's densityFromMaterial).
 */
function fabricPoseClause(material: string | null | undefined): string {
  const weight = classifyFabricWeight(material);
  if (weight === "heavy") {
    return "This fabric is heavy and structured: the pose stays static and sculptural, holding the fabric's own natural structured pleats and fall — no implied movement, which would fight against how this weight of fabric actually behaves.";
  }
  if (weight === "light") {
    return "This fabric is light and flowing: the pose gently implies motion, as if caught mid-step or stirred by a soft breeze — this fabric shows its most beautiful movement in motion, never standing perfectly rigid and still.";
  }
  return "";
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
  /** Optional fabric type (Product.material) — selects static/sculptural vs. motion-implying posing. */
  material?: string | null;
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
 * Outfit completion — when the product is a PARTIAL garment (a top without
 * bottoms, a bottom without a top, a blouse without a saree), the model must
 * wear a complete, professionally styled outfit — never leave the body bare,
 * transparent or cropped. The complementary garment is derived from the
 * product category and uses the product's own colour for coordination.
 *
 * Indian ethnic wear is NOT western dress: a kurta needs churidar/leggings,
 * a blouse needs a saree or long skirt, a salwar needs a kurta. The AI must
 * treat these as coordinated ensembles, not standalone pieces.
 */
function outfitCompletionClause(category: string, color: string): string {
  const cat = category.trim().toLowerCase();

  // Top-wear categories — need appropriate bottoms
  if (cat === "blouse") {
    return `OUTFIT COMPLETION (mandatory): The blouse is a partial garment — the model MUST wear a complete outfit. Pair it with a simple, elegant saree or a floor-length skirt in a colour that complements ${color}. The complementary garment should be plain and understated so the blouse remains the hero product. NEVER leave the lower body bare, transparent, skin-coloured, or empty — this must look like a professional catalogue photo of a complete Indian ethnic outfit.`;
  }
  if (cat === "kurti" || cat === "kurta") {
    return `OUTFIT COMPLETION (mandatory): The ${cat} MUST be shown as part of a complete outfit. The model wears well-fitted churidar, leggings, or a slim salwar in a neutral or tonal shade that complements ${color} (e.g. matching, off-white, beige, or cream). NEVER leave the lower body bare, transparent, or empty — Indian ethnic wear always includes coordinated bottom-wear. The bottom-wear is plain and understated so the ${cat} remains the hero product.`;
  }

  // Bottom-wear categories — need appropriate tops (waist-length so product is visible)
  if (cat === "salwar" || cat === "palazzo" || cat === "sharara") {
    return `OUTFIT COMPLETION (mandatory): The ${cat} is bottom-wear and MUST be shown with a complete outfit. The model wears a simple, plain kurta or kurti that ends at waist to hip length in a neutral or tonal shade that complements ${color}, so the ${cat} product is clearly visible below. NEVER leave the upper body bare, in just an undergarment, or empty — this is Indian ethnic wear and must look like a complete, professionally coordinated outfit. The top is understated so the ${cat} remains the hero product.`;
  }
  if (cat === "leggings" || cat === "churidar" || cat === "pyjama") {
    return `OUTFIT COMPLETION (mandatory): The ${cat} is bottom-wear and MUST be shown with a complete outfit. The model wears a simple, plain kurta, kurti, or long top that ends at waist to hip length in a neutral or tonal shade that complements ${color}, so the ${cat} is clearly visible below. NEVER leave the upper body bare or in just an undergarment. The top is understated so the ${cat} remains the hero product.`;
  }

  // Dupatta — needs an underlying outfit
  if (cat === "dupatta") {
    return `OUTFIT COMPLETION (mandatory): The dupatta is draped elegantly and MUST be shown over a complete outfit — a simple, plain kurta or suit set in a neutral or tonal shade that complements ${color}. The underlying outfit is understated so the dupatta's print, weave and colour remain the hero. NEVER show just the dupatta floating on a bare body.`;
  }

  // Lehenga — ensure choli/blouse is present
  if (cat === "lehenga") {
    return `OUTFIT COMPLETION (mandatory): The lehenga MUST be shown as a complete outfit with a well-fitted choli or blouse and dupatta. The choli colour should complement ${color}. The lehenga skirt is the hero product.`;
  }

  return "";
}

/**
 * Front and back are INDEPENDENT generations, so every element that is not the
 * product itself — footwear, any complementary top or bottoms (a bottom for a
 * top-wear product, a top for a bottom-wear product), and any jewellery or
 * accessories — is otherwise invented afresh per view and can disagree
 * (different shoes, different trousers, a necklace on one view only). This
 * pins all of them to "simple, neutral and IDENTICAL across views" so a single
 * product's catalogue set reads as one coherent shoot. Deterministic,
 * category-agnostic; the product garment itself is unaffected.
 */
const STYLING_CONSISTENCY_CLAUSE =
  "Every element that is not the product garment itself — footwear, any complementary top or bottoms worn with the product, and any jewellery or accessories — must be simple, understated, and kept exactly identical in colour and style across all views, so the front and back read as the same outfit photographed in one session.";

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
    return "Camera orientation (mandatory, override any product image angle): the model faces the camera directly in a straight-on front-facing pose, front of the garment fully visible — never shown from behind, from the side, at a three-quarter angle, over-the-shoulder, or walking away. Even if the product photo is a side or back shot, the generated image MUST be a direct front view.";
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
// Reserved label used by AI Casting to pack the face-library reference image
// into `extraReferences` (see lib/model-gen/casting-prompt.ts). Detected here
// so the face gets an identity clause instead of the garment-region clause;
// duplicated as a plain string (not an import) so this file stays a leaf
// module the casting layer never depends on.
const IDENTITY_FACE_LABEL_INTERNAL = "__identity_face__";
const CROSS_VIEW_LABEL_INTERNAL = "__cross_view_ref__";

function extraImageClause(
  refs: Array<{ label: string; placement: string }> | undefined,
  startIndex: number
): string {
  if (!refs || refs.length === 0) return "";
  const lines = refs.map((r, i) => {
    if (r.label === IDENTITY_FACE_LABEL_INTERNAL) {
      return `Image ${startIndex + i} is the model's face identity reference — reproduce this exact face on the generated model; it is the person, NOT a garment part.`;
    }
    if (r.label === CROSS_VIEW_LABEL_INTERNAL) {
      return `Image ${startIndex + i} is the ${r.placement} of this exact same model from this same photo session — the current view MUST show the exact same person: same hair (colour, length, style, parting), same skin tone, same body build and proportions, same outfit and accessories. Only the camera angle changes.`;
    }
    if (r.label === GI_REGION_LABEL) {
      return `Image ${startIndex + i} is a real close-up photo of this exact same garment, for SURFACE TEXTURE AND RELIEF fidelity only. ${r.placement}`;
    }
    return `Image ${startIndex + i} is a real close-up photo of ${r.label} of this exact same garment — faithfully reproduce its exact design, motif, colour and surface texture on ${r.placement}.`;
  });
  lines.push(
    "These extra images are reproduction references only — reproduce the face identity where indicated and the garment regions otherwise. Never display, paste, inset, tile, float or show these reference images, or any swatch, cut-out, panel or copy of them, anywhere in the output."
  );
  return lines.join(" ");
}

export function buildViewPrompt(input: ViewPromptInput): string {
  const { category, color, gender, view, hasReference, detailNotes, material, backdrop, studioAnchor, extraReferences } = input;
  const detail = detailClause(detailNotes);
  const backGuard = backGuardClause(view.id, detailNotes);
  const blouse = blouseClause(category, color);
  const outfitCompletion = outfitCompletionClause(category, color);
  const anchor = anchorClause(studioAnchor);
  const styling = STYLING_CONSISTENCY_CLAUSE;
  const orientation = orientationClause(view.id);
  const realism = realismClause(category, view.id);
  const hair = hairClause(gender);
  const fabricPose = fabricPoseClause(material);
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
    const total = 2 + extraCount; // drape ref + product + extras
    // Image 1 is a construction/fit reference ONLY — never an identity
    // source. Identity (face/skin/hair/build) comes from the AI Casting
    // identity reference or the cross-view reference when either is present
    // (see extraImageClause below), or is otherwise left to the generator,
    // steered by subjectFor() and the realism clause — never copied from
    // this drape asset. A single unambiguous identity source per generation,
    // instead of Image 1 and a Casting/cross-view reference competing for
    // the same claim (the confirmed cause of front/back face mismatches, and
    // of Casting's skinTone/bodyType overrides losing to the reference).
    const structureClause =
      "Image 1 is a construction reference showing how this category of garment drapes, sits and fits on a body — use it ONLY to understand the garment's structural silhouette and fabric flow around the body. Do not copy this image's pose, lighting, background, or the pictured person's face, skin tone, texture, hair or body proportions.";
    const garmentClause = "Reproduce the garment's exact colour, print and texture from Image 2.";
    return [
      `You are given ${total} images. Image 1 is a structural drape/fit reference. Image 2 is the product garment.`,
      `Generate a photorealistic photograph of ${subjectFor(gender)} wearing this ${color} ${category} from Image 2.`,
      structureClause,
      garmentClause,
      extraImageClause(extraReferences, 3),
      view.modifier,
      detail,
      backGuard,
      blouse,
      outfitCompletion,
      styling,
      backdrop,
      anchor,
      orientation,
      realism,
      hair,
      fabricPose,
      LIGHTING_CORE,
      COLOR_GRADE,
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
    outfitCompletion,
    backdrop,
    anchor,
    orientation,
    realism,
    hair,
    fabricPose,
    LIGHTING_CORE,
    COLOR_GRADE,
    swatchGuard,
  ].filter(Boolean).join(" ");
}

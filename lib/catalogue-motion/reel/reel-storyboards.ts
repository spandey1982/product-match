/**
 * Ad/Marketing Reel storyboard library — per-category shot sequences tuned
 * for ad pacing and engagement, not systematic catalogue coverage.
 *
 * Four shots, always in this order (the reel-playbook.ts hook/journey/close
 * structure is authoritative and does not vary by category):
 *   hook        → static camera ("breathing-hold"), direct engagement with
 *                 the lens plus one small, real gesture. Research basis:
 *                 static-camera + lens engagement is what reads as "talking
 *                 to you" (parasocial direct-address research), not a
 *                 camera trick — see the session's reel-reference-study.
 *   interaction → slow push-in while a hand does something real WITH the
 *                 product (touch, lift, smooth) — the "vicarious haptic
 *                 effect" (Peck & Shu 2009; Luangrath et al. 2022): watching
 *                 a hand touch a product measurably lifts purchase intent.
 *   detail      → macro push on the category's craftsmanship crop. ALWAYS
 *                 isDetailTruth: true — animates the raw original source
 *                 photo regardless of presentation, never the generated
 *                 model/mannequin photo (see reel-types.ts's doc comment).
 *   close       → slow pull-out, held facing away from camera — never a turn
 *                 toward the lens (see excludeFace on ReelStoryboardShot: a
 *                 live test found a "turn to reveal" instruction let Veo
 *                 render a mismatched face mid-turn). The natural close per
 *                 reel-playbook.ts, feeds into compose.ts's branded end-card.
 *
 * Scope: covers the garment-on-model categories (the ones this feature was
 * scoped for throughout — worn-product reels). Object-only categories
 * (footwear, handbags, jewellery, standalone dupatta, accessories) fall back
 * to DEFAULT below rather than bespoke lists — "worn by a model or shown on
 * a mannequin" doesn't map cleanly onto them the same way, and none of this
 * session's reference research targeted that case. Worth a dedicated pass
 * later, not a silent gap: flagged in the handoff, not built here.
 */
import type { ReelStoryboard, ReelStoryboardShot } from "./reel-types";
import { classifyFabricWeight } from "@/lib/model-gen/fabric-weight";

/**
 * Heavy-embellishment pattern language — same vocabulary as
 * reel/lighting.ts's MATERIAL_LIGHTING, reused here for a different purpose:
 * deciding how long the craftsmanship-detail shot should hold. Kept as its
 * own regex rather than importing lighting.ts's private constant, since the
 * two call sites judge different things (light treatment vs. hold length)
 * even though the trigger vocabulary happens to overlap.
 */
const HEAVY_EMBELLISHMENT_PATTERN = /brocade|jacquard|zari|embroider|embellish/i;

/**
 * Density signal for the detail shot's hold length. Originally built when
 * the detail shot was always pan-zoom (local ffmpeg, zero AI cost, so
 * lengthening it for a denser pattern cost nothing) — as of 2026-09-06 the
 * detail shot is ai-motion (see detailShot() below), so this function's
 * output is now capped at the shot's own default by reelStoryboardFor()
 * rather than actually lengthening anything; see that function's doc
 * comment for why. Kept as a live signal, not deleted, for when a longer
 * hold is worth deliberately re-enabling.
 */
function detailHoldSecFor(material: string | null | undefined, pattern: string | null | undefined): number {
  const heavyPattern = HEAVY_EMBELLISHMENT_PATTERN.test(`${material ?? ""} ${pattern ?? ""}`);
  const weight = classifyFabricWeight(material);
  if (heavyPattern || weight === "heavy") return 6;
  if (weight === "light" && !heavyPattern) return 3;
  return 4;
}

/**
 * Shared fallback for every category's one QA-rejection retry, on every shot
 * role (hook/interaction/close) — deliberately pose-agnostic. An earlier
 * version described a specific alternate hand position per category/role
 * ("hands at her sides", "rests against the plain waist section") on the
 * theory that moving contact away from the densest pattern area reduces
 * risk. Live-tested finding (2026-09-06, a lehenga whose anchor photo
 * already shows a hand gripping the dupatta — a conventional styling pose
 * for that category): the "hands at her sides" alt cue did not prevent a
 * rejection citing that same hand's interaction with the dupatta, because
 * the instruction describes a target pose, it can't erase a physical
 * starting condition already present in the anchor photo's pixels. A
 * pose-agnostic freeze (whatever is already in frame, don't move it) works
 * regardless of what that starting pose happens to be, without needing to
 * guess or hardcode a per-category assumption about it.
 */
const FREEZE_ALT_CUE =
  "whatever pose and hand position are already visible in the first frame, hold them completely still for the entire shot — no lifting, adjusting, gathering, or repositioning of the hands, arms, or any part of the garment, regardless of what they are already resting on or near; only the same natural ambient micro-motion (blinking, breathing, a barely perceptible weight shift) continues, no additional deliberate gesture is added";
/** Hook's retry keeps the direct-lens engagement (the shot's whole purpose) on top of the shared freeze. */
const HOOK_ALT_CUE = `meet the camera's gaze with sustained eye contact; ${FREEZE_ALT_CUE}`;

function hookShot(sourceBase: "front" | "back", engagementCue: string, rationale: string): ReelStoryboardShot {
  return {
    view: sourceBase,
    label: "Hook",
    presetId: "breathing-hold",
    durationSec: 4,
    sourceBase,
    renderMode: "ai-motion",
    role: "hook",
    isDetailTruth: false,
    engagementCue,
    engagementCueAlt: HOOK_ALT_CUE,
    rationale,
  };
}

function interactionShot(sourceBase: "front" | "back", engagementCue: string, rationale: string): ReelStoryboardShot {
  return {
    view: `${sourceBase}-interaction`,
    label: "Interaction",
    presetId: "slow-push-in",
    durationSec: 4,
    sourceBase,
    renderMode: "ai-motion",
    role: "interaction",
    isDetailTruth: false,
    engagementCue,
    engagementCueAlt: FREEZE_ALT_CUE,
    rationale,
  };
}

/**
 * ai-motion, not pan-zoom — reversed 2026-09-06 after direct user feedback
 * ("always blurry and non-moving... not natural, complete failure") plus a
 * second reference study (two real Instagram ad reels): a pan-zoom clip is a
 * deterministic ffmpeg crop+zoom on ONE STILL PHOTO, which cannot show any
 * motion by construction, no matter the preset — precisely why it read as
 * dead (Johansson 1973, this project's own first-cited finding, simply never
 * pointed at this shot type before). The reference videos showed the actual
 * pattern that reads as alive: a tightly-framed, near-static CAMERA with a
 * real, small, living subject still moving inside it — not a moving camera
 * on a frozen one.
 *
 * Still isDetailTruth: true, still the raw original source photo, never the
 * generated model/mannequin photo — that guarantee is unrelated to the
 * motion question and stays (see reel-types.ts's doc comment: the generated
 * photo isn't a trustworthy source of the product's real surface detail).
 * What changed is only HOW that raw crop gets animated.
 *
 * presetId "breathing-hold" (fully static camera) deliberately, not a push/
 * zoom: this is the highest pattern-fidelity-risk shot in the whole reel (the
 * tightest framing on the exact texture that must stay crisp), and Component
 * 9's own finding is that camera movement compounds distortion risk on dense
 * patterns — the crop itself already provides the "close" framing, so the
 * camera doesn't need to move to get there.
 *
 * Live-tested finding (2026-09-06): the first version of this cue described
 * "a hand rests gently at the edge of..." on the theory that zero-
 * displacement contact (already validated for interaction shots) would
 * transfer here too. It didn't — checking the actual resolved crop images
 * directly showed every detail crop is pure fabric with no hand, arm, or
 * body part anywhere in the source photo, so that cue was asking Veo to
 * INVENT a hand into a hand-less frame, a harder and riskier ask than
 * holding an already-present hand still. The live test confirmed the risk:
 * Veo escalated the invented hand into a full grab-and-lift gesture that
 * visibly warped the pattern underneath. Every cue below now describes the
 * fabric alone, with no hand or body part mentioned at all, paired with
 * FABRIC_DETAIL_CONSTRAINTS (reel-prompt-builder.ts) which explicitly
 * forbids introducing one.
 */
const DETAIL_ALT_CUE =
  "absolutely no motion of any kind anywhere in the frame — the fabric stays completely frozen exactly as in the first frame for the entire duration; no hand, no arm, no shift in light, no camera movement";

function detailShot(sourceBase: "front" | "back", cropId: string, engagementCue: string, rationale: string): ReelStoryboardShot {
  return {
    view: cropId,
    label: "Craftsmanship Detail",
    presetId: "breathing-hold",
    durationSec: 4,
    sourceBase,
    cropId,
    renderMode: "ai-motion",
    role: "detail",
    isDetailTruth: true,
    engagementCue,
    engagementCueAlt: DETAIL_ALT_CUE,
    rationale,
  };
}

/**
 * excludeFace: true always — a back-facing close shot must never risk
 * showing the model's face (see reel-types.ts's doc comment: a live test
 * found a "turn to reveal" instruction let Veo render a mid-turn face that
 * didn't match the other shots). Enforced by cropping to neck-down in
 * reference-resolver.ts, not just by the engagementCue wording — the cue
 * itself should describe staying facing away, not turning.
 */
function closeShot(sourceBase: "front" | "back", engagementCue: string, rationale: string): ReelStoryboardShot {
  return {
    view: `${sourceBase}-close`,
    label: "Close",
    presetId: "slow-pull-out",
    durationSec: 4,
    sourceBase,
    renderMode: "ai-motion",
    role: "close",
    isDetailTruth: false,
    engagementCue,
    engagementCueAlt: FREEZE_ALT_CUE,
    excludeFace: true,
    rationale,
  };
}

const SAREE: ReelStoryboard = {
  categoryKey: "saree",
  label: "Saree",
  shots: [
    hookShot("front", "meet the camera's gaze, one hand resting lightly on the pallu at the shoulder, fingers settling in place", "Direct engagement opens the reel, not a static establish"),
    interactionShot("front", "a hand rests gently against the pallu's embroidered edge, fingers settling naturally on the fabric", "Real hand-on-product contact, not passive display"),
    detailShot("front", "blouse", "the blouse's embroidered neckline is held in sharp, steady focus with no change from the first frame — the beadwork and embroidery stay exactly as photographed, with only the most subtle, barely perceptible shift in sheen as ambient light moves fractionally across the fabric", "Blouse embroidery needs pixel fidelity from the real photo, not a re-generated one"),
    closeShot("back", "hold steady facing away from camera as the pallu settles and sways gently at the shoulder", "Natural close before the branded end-card"),
  ],
};

const LEHENGA: ReelStoryboard = {
  categoryKey: "lehenga",
  label: "Lehenga",
  shots: [
    hookShot("front", "meet the camera's gaze, one hand resting lightly on the dupatta", "Direct engagement opens the reel"),
    interactionShot("front", "a hand rests gently on the dupatta's edge, fingers settling naturally against the embroidery", "Real hand-on-product contact"),
    detailShot("front", "blouse", "the blouse's embellished neckline is held in sharp, steady focus with no change from the first frame — the embroidery and mirror work stay exactly as photographed, with only the most subtle, barely perceptible shift in sheen as ambient light moves fractionally across the fabric", "Embellishment craftsmanship needs the real photo's pixel fidelity"),
    closeShot("back", "hold steady facing away from camera as the skirt's fabric settles and sways gently", "Natural close before the branded end-card"),
  ],
};

const KURTI: ReelStoryboard = {
  categoryKey: "kurti",
  label: "Kurti / Kurta",
  shots: [
    hookShot("front", "meet the camera's gaze with a relaxed, natural expression, one hand resting lightly on the sleeve, fingers settling in place", "Direct engagement opens the reel"),
    interactionShot("front", "a hand rests at the waist, fingers settling naturally against the fabric", "Real hand-on-product contact"),
    detailShot("front", "neckline", "the neckline's embroidered trim is held in sharp, steady focus with no change from the first frame — the fine stitching stays exactly as photographed, with only the most subtle, barely perceptible shift in sheen as ambient light moves fractionally across the fabric", "Neckline design needs the real photo's pixel fidelity"),
    closeShot("back", "hold steady facing away from camera as the fabric settles naturally at the hemline", "Natural close before the branded end-card"),
  ],
};

const SHIRT: ReelStoryboard = {
  categoryKey: "shirt",
  label: "Shirt",
  shots: [
    hookShot("front", "meet the camera's gaze, one hand resting lightly on the collar, fingers settling in place", "Direct engagement opens the reel"),
    interactionShot("front", "a hand rests on the placket, a fingertip settling naturally against a button", "Real hand-on-product contact"),
    detailShot("front", "collar", "the collar is held in sharp, steady focus with no change from the first frame — the pattern and stitching stay exactly as photographed, with only the most subtle, barely perceptible shift in sheen as ambient light moves fractionally across the fabric", "Collar shape and stitching need the real photo's pixel fidelity"),
    closeShot("back", "hold steady facing away from camera as the fabric settles naturally across the back", "Natural close before the branded end-card"),
  ],
};

const DRESS: ReelStoryboard = {
  categoryKey: "dress",
  label: "Dress",
  shots: [
    hookShot("front", "meet the camera's gaze, one hand lightly touching the neckline", "Direct engagement opens the reel"),
    interactionShot("front", "a hand rests at the waist, fingers settling naturally against the fabric", "Real hand-on-product contact"),
    detailShot("front", "bodice", "the bodice's neckline is held in sharp, steady focus with no change from the first frame — the construction detail stays exactly as photographed, with only the most subtle, barely perceptible shift in sheen as ambient light moves fractionally across the fabric", "Neckline and construction detail need the real photo's pixel fidelity"),
    closeShot("back", "hold steady facing away from camera as the fabric settles naturally along the silhouette", "Natural close before the branded end-card"),
  ],
};

const JACKET: ReelStoryboard = {
  categoryKey: "jacket",
  label: "Jacket / Blazer",
  shots: [
    hookShot("front", "meet the camera's gaze, one hand resting lightly on the lapel, fingers settling in place", "Direct engagement opens the reel"),
    interactionShot("front", "a hand rests on the lapel, fingers settling naturally against it", "Real hand-on-product contact"),
    detailShot("front", "lapel", "the lapel is held in sharp, steady focus with no change from the first frame — the weave and stitching stay exactly as photographed, with only the most subtle, barely perceptible shift in sheen as ambient light moves fractionally across the fabric", "Lapel shape and fabric need the real photo's pixel fidelity"),
    closeShot("back", "hold steady facing away from camera as the fabric settles naturally across the shoulder line", "Natural close before the branded end-card"),
  ],
};

const TROUSER: ReelStoryboard = {
  categoryKey: "trouser",
  label: "Jeans / Trousers",
  shots: [
    hookShot("front", "meet the camera's gaze, one hand resting lightly on the waistband, fingers settling in place", "Direct engagement opens the reel"),
    interactionShot("front", "a hand rests on the fabric at the thigh, fingers settling naturally against it", "Real hand-on-product contact"),
    detailShot("front", "fabric", "the fabric is held in sharp, steady focus with no change from the first frame — the wash and weave stay exactly as photographed, with only the most subtle, barely perceptible shift in sheen as ambient light moves fractionally across it", "Denim wash and weave need the real photo's pixel fidelity"),
    closeShot("back", "hold steady facing away from camera as the fabric settles naturally at the back", "Natural close before the branded end-card"),
  ],
};

const DEFAULT: ReelStoryboard = {
  categoryKey: "default",
  label: "Default",
  shots: [
    hookShot("front", "meet the camera's gaze with a natural, engaged expression", "Direct engagement opens the reel"),
    interactionShot("front", "a hand rests gently on the garment, fingers settling naturally in place", "Real hand-on-product contact"),
    detailShot("front", "design", "the garment's design detail is held in sharp, steady focus with no change from the first frame — the fabric's texture stays exactly as photographed, with only the most subtle, barely perceptible shift in sheen as ambient light moves fractionally across it", "Design detail needs the real photo's pixel fidelity"),
    closeShot("back", "hold steady facing away from camera as the fabric settles naturally", "Natural close before the branded end-card"),
  ],
};

const REEL_STORYBOARD_MAP: Record<string, ReelStoryboard> = {
  saree: SAREE,
  lehenga: LEHENGA,
  sharara: LEHENGA,
  kurta: KURTI,
  kurti: KURTI,
  shirt: SHIRT,
  tshirt: SHIRT,
  dress: DRESS,
  anarkali: DRESS,
  suit: JACKET,
  waistcoat: JACKET,
  jacket: JACKET,
  trouser: TROUSER,
  jeans: TROUSER,
};

function normalize(category: string | null | undefined): string {
  return (category ?? "").toLowerCase().replace(/[\s_-]/g, "");
}

/**
 * Resolves the fixed per-category shot list and, when material/pattern are
 * given, returns a shallow copy with the detail shot's durationSec adjusted
 * for that specific product — never mutates the shared category constants
 * above (SAREE, LEHENGA, ...), which every product in that category reuses.
 *
 * The density-based lengthening (detailHoldSecFor) is capped at the shot's
 * own default (never lengthens it) as of the detail shot's 2026-09-06
 * conversion from pan-zoom to ai-motion: that override was built entirely on
 * "this shot is free and zero-risk, so a longer hold for a denser pattern
 * costs nothing" — a premise that stopped being true the moment the shot
 * started billing Veo per second and inheriting Component 9's real
 * pattern-fidelity-under-motion risk. Silently letting a dense/heavy product
 * (already flagged higher-risk by pattern-risk.ts) also get a LONGER, MORE
 * EXPENSIVE detail shot would compound exactly the risk that flag exists to
 * manage. The function and its density signal are kept, not deleted — worth
 * reinstating deliberately once ai-motion detail shots are validated safe,
 * as a considered choice ("this is real motion worth lingering on") rather
 * than a leftover from when it was free.
 */
export function reelStoryboardFor(
  category: string | null | undefined,
  materialHint?: { material?: string | null; pattern?: string | null }
): ReelStoryboard {
  const base = REEL_STORYBOARD_MAP[normalize(category)] ?? DEFAULT;
  if (!materialHint) return base;
  const detailHoldSec = Math.min(4, detailHoldSecFor(materialHint.material, materialHint.pattern));
  return {
    ...base,
    shots: base.shots.map((s) => (s.role === "detail" ? { ...s, durationSec: detailHoldSec } : s)),
  };
}

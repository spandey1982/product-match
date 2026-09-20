/**
 * Ad/Marketing Reel prompt construction — the engagement-permissive
 * counterpart to lib/catalogue-motion/prompt-builder.ts.
 *
 * Why this can't just reuse the catalogue prompt builder: its
 * UNIVERSAL_CONSTRAINTS explicitly bans hand gestures, head turns,
 * expression change, and walking — correct for catalogue mode (fidelity is
 * QA-verified pixel-for-pixel), but exactly backwards for a reel, whose
 * entire premise (per this session's reel-reference-study and its
 * peer-reviewed backing) is that those are the things that make a viewer
 * engage. Reel shots need their own constraint philosophy: permissive of
 * ONE described action per shot, still strict about garment fidelity and
 * background/lighting stability.
 *
 * Camera-movement language is shared with catalogue mode (CAMERA_TEMPLATES,
 * INTENSITY_DESCRIPTOR) — only the universal constraint suffix differs.
 */
import { CAMERA_TEMPLATES, INTENSITY_DESCRIPTOR } from "../prompt-builder";
import type { MotionPreset, MotionConstraints, MotionIntensity } from "../types";
import type { ReelPresentation } from "./reel-types";

const MODEL_CONSTRAINTS =
  "The model performs exactly ONE described deliberate action for this shot — " +
  "sustained eye contact with the camera, a natural head turn, a genuine hand " +
  "gesture touching or adjusting the product, or a subtle change in expression " +
  "— as the main, purposeful motion. The model's facial expression for this shot is " +
  "governed entirely by what this instruction describes, not by extrapolating " +
  "or developing whatever expression happens to already be visible in the " +
  "source photograph: if the source photo shows a slight smile and this " +
  "instruction does not call for a smile, that expression must hold exactly " +
  "as it is or settle to neutral, and must never grow into a broader smile or " +
  "shift into a different expression on its own. Alongside that one action, natural " +
  "involuntary micro-motion is expected and should be visibly present: gentle " +
  "blinking, subtle natural breathing, a barely perceptible weight shift, hair " +
  "settling slightly — a real person is never perfectly frozen between " +
  "movements, and the shot should not look like a still photo with one part " +
  "animated. What must NOT happen: no walking, no large or sweeping body " +
  "movement, no second deliberate gesture beyond the one described, no " +
  "wardrobe change. Where the described action involves a hand touching the " +
  "product, the hand makes and holds static contact — resting, settling, a " +
  "fingertip against the fabric — and does not drag, pull, lift away from the " +
  "body, or trace a path across the fabric's surface; the garment's drape " +
  "should look undisturbed by the contact, not repositioned by it. The " +
  "garment itself must not distort, morph, stretch, or " +
  "change color or pattern. The background and studio lighting remain fixed " +
  "and unchanged throughout — no new elements, no color drift, no shadow " +
  "movement. No camera shake, no jitter, no handheld feel unless the camera " +
  "instruction above specifically describes one. The output must be " +
  "photoreal, filling the frame edge-to-edge: no letterboxing, no pillarboxing, " +
  "no added borders, no watermarks, no text, no graphic overlays of any kind " +
  "that are not part of the original photograph.";

/**
 * For detail/craftsmanship shots specifically — NOT a variant of
 * MODEL_CONSTRAINTS with the hand removed, a genuinely different block.
 * Added 2026-09-06 after this exact category of shot failed its first live
 * test: checking the actual resolved crop images directly (not assumed)
 * showed every detail crop (saree blouse, shirt collar, etc.) is pure
 * fabric — no hand, no arm, no body part anywhere in the source frame. The
 * original engagementCues described "a hand rests..." anyway, which asked
 * Veo to INVENT a hand into a hand-less frame — a strictly harder and
 * riskier generative task than holding an already-present hand still, and
 * the live test showed Veo escalating that invented hand into a full
 * grab-and-lift gesture that visibly warped the pattern underneath. This
 * block removes the possibility structurally: no action menu that implies a
 * person is present, an explicit prohibition on introducing one, and no
 * depth-of-field line either (checked the same way — these crops fill the
 * frame edge-to-edge with fabric, there is no separate background layer to
 * blur, so that instruction would have had nothing real to attach to).
 */
const FABRIC_DETAIL_CONSTRAINTS =
  "This shot is a close, static view of the garment's fabric and surface " +
  "detail only. The source photograph shows no person, hand, arm, or any " +
  "part of a body — none should appear at any point during the shot. Do " +
  "not introduce a hand, arm, or any body part into the frame under any " +
  "circumstances, and do not imply one is present just out of frame by " +
  "animating the fabric as if touched or moved by something unseen. Every " +
  "motif, stitch, weave, and texture must stay pixel-identical to the " +
  "source photograph throughout — no distortion, no morphing, no " +
  "stretching, no change in color or pattern. The background and studio " +
  "lighting remain fixed and unchanged throughout — no new elements, no " +
  "color drift, no shadow movement. No camera shake, no jitter, no " +
  "handheld feel unless the camera instruction above specifically " +
  "describes one. The output must be photoreal, filling the frame " +
  "edge-to-edge: no letterboxing, no pillarboxing, no added borders, no " +
  "watermarks, no text, no graphic overlays of any kind that are not part " +
  "of the original photograph.";

const MANNEQUIN_CONSTRAINTS =
  "This is a display mannequin or dress form, not a living person: there must " +
  "be no organic human motion of any kind — no breathing, no skin movement, no " +
  "implied life. The mannequin form itself stays completely rigid and static " +
  "throughout. The only motion allowed is the garment's own physical movement " +
  "(fabric settling, swaying, or catching light) and the camera movement " +
  "described above. The garment must not distort, morph, stretch, or change " +
  "color or pattern. The background and studio lighting remain fixed and " +
  "unchanged throughout. The output must be photoreal, filling the frame " +
  "edge-to-edge: no letterboxing, no pillarboxing, no added borders, no " +
  "watermarks, no text, no graphic overlays of any kind that are not part of " +
  "the original photograph.";

/**
 * A cinematic-depth cue, reel-only — catalogue mode deliberately keeps
 * everything tack sharp since its QA is a pixel-fidelity check, but a reel's
 * own research (research/reel-engine-components.html, Component 1) has no
 * lens-behavior instruction anywhere today despite every strong reference
 * clip having a softly out-of-focus background behind a sharp subject.
 * Worded to bias toward the falloff already implicit in the source photo's
 * depth rather than invent a new background — the constraint blocks above
 * already forbid new background elements, so this only asks for a focus
 * treatment, not new content.
 */
const DEPTH_OF_FIELD_LINE =
  " The subject stays tack sharp for the full shot; the space behind it " +
  "falls into soft, shallow depth-of-field blur — a subtle focus falloff " +
  "on the background already visible in the source photo, not a new or " +
  "different background.";

export interface ReelClipInstruction {
  text: string;
  params: {
    presetId: string;
    intensity: MotionIntensity;
    durationSec: number;
    cameraMagnitude: number;
    maxZoom: number;
    maxOrbitDeg: number;
  };
}

export function buildReelClipInstruction(
  preset: MotionPreset,
  intensity: MotionIntensity,
  constraints: MotionConstraints,
  durationSec: number,
  presentation: ReelPresentation,
  /** The one action this shot should show — from ReelStoryboardShot.engagementCue. */
  engagementCue: string,
  /** Per-material lighting treatment — lib/catalogue-motion/reel/lighting.ts. */
  lightingDescriptor: string,
  /**
   * True for craftsmanship-detail shots (ReelStoryboardShot.isDetailTruth) —
   * selects FABRIC_DETAIL_CONSTRAINTS instead of MODEL_/MANNEQUIN_CONSTRAINTS
   * and skips the depth-of-field line, regardless of `presentation`. See that
   * block's doc comment for why: these crops are confirmed pure fabric, no
   * person and no separate background layer to blur.
   */
  isDetailTruth = false,
): ReelClipInstruction {
  const template = CAMERA_TEMPLATES[preset.id];
  if (!template) {
    throw new Error(`No prompt template registered for preset "${preset.id}"`);
  }

  const magnitude = INTENSITY_DESCRIPTOR[intensity];
  const cameraLine = template(magnitude);
  const lightingLine = ` The lighting on the garment reads as ${lightingDescriptor}.`;
  const dofLine = isDetailTruth ? "" : DEPTH_OF_FIELD_LINE;
  const constraintBlock = isDetailTruth
    ? FABRIC_DETAIL_CONSTRAINTS
    : presentation === "mannequin"
      ? MANNEQUIN_CONSTRAINTS
      : MODEL_CONSTRAINTS;
  const actionLine =
    isDetailTruth || presentation === "mannequin"
      ? ` For this shot specifically: ${engagementCue}`
      : ` For this shot specifically, the described action is: ${engagementCue}`;
  const text = `${cameraLine}${lightingLine}${dofLine} ${constraintBlock}${actionLine} Duration: ${durationSec} seconds.`;

  return {
    text,
    params: {
      presetId: preset.id,
      intensity,
      durationSec,
      cameraMagnitude: constraints.cameraMagnitude,
      maxZoom: constraints.maxZoom,
      maxOrbitDeg: constraints.maxOrbitDeg,
    },
  };
}

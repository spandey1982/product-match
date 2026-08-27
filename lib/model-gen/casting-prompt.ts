/**
 * Casting → prompt refinement.
 *
 * Renders a resolved casting brief into a compact prompt suffix appended to
 * the strategy's view prompt. Additive only — never restructures the base
 * prompt, so existing generation behaviour is preserved when Casting is off.
 *
 * Also owns the small conventions the prompt-sets layer needs to identify a
 * face reference among the labelled extras (see IDENTITY_FACE_LABEL and
 * extraImageClause in prompt-sets.ts).
 *
 * Cost: pure text — no new AI calls, ~40–80 additional prompt tokens per
 * generation. Verified aspect ratio and image quality are untouched (both
 * are set at the generation-call level in quality.ts).
 */
import type {
  ResolvedCastingMetadata,
  PoseMode,
  Expression,
} from "./casting-types";

/**
 * Reserved label used by strategies when packing the face-library reference
 * image into `extraReferences`. prompt-sets.ts's extraImageClause detects
 * this exact label and emits an identity clause instead of the garment-region
 * clause. Keep it string-typed (not a Symbol) — the label crosses process
 * boundaries (persistence, logs).
 */
export const IDENTITY_FACE_LABEL = "__identity_face__";

/** Retailer-facing persona label — for prompt text only, not for UI. */
function personaText(persona: ResolvedCastingMetadata["persona"]): string {
  switch (persona) {
    case "luxury-bridal":         return "luxury bridal";
    case "heritage-traditional":  return "heritage traditional";
    case "professional-formal":   return "professional formal";
    case "youth-casual":          return "youth casual";
    case "urban-minimal":         return "urban minimal";
  }
}

/**
 * Expression as a genuine facial description, not a bare adjective — a
 * "soft-smile" rendered as literally "soft smile expression" was the
 * confirmed source of the generic, eyes-uninvolved posed-smile look (see
 * research/why-it-looks-ai.html). Every entry engages the eyes, matching
 * the Duchenne-smile finding: a genuine expression involves the eyes as
 * much as the mouth, not the mouth alone.
 */
const EXPRESSION_TEXT: Record<Expression, string> = {
  neutral: "a calm, natural expression with relaxed, engaged eyes",
  warm: "a warm, genuine smile that reaches the eyes, with a soft catchlight visible in both eyes",
  confident: "a confident, natural expression with direct but relaxed, engaged eyes",
  "soft-smile": "a gentle, natural smile that reaches the eyes with a soft catchlight — not a flat, posed smile",
  serious: "a composed, natural expression with alert, engaged eyes",
};

/**
 * A one-sentence appearance clause. Reads naturally in an existing image-gen
 * prompt (Gemini/Imagen respond well to plain descriptive English rather than
 * key:value lists).
 */
function appearanceClause(m: ResolvedCastingMetadata): string {
  return (
    `Model appearance: ${m.skinTone} complexion with natural skin texture and subtle tonal variation, ` +
    `${m.hairStyle} ${m.hairColor} hair, ${EXPRESSION_TEXT[m.expression]}, ${m.bodyType} build.`
  );
}

/**
 * Studio mode says nothing — the drape reference pins the pose exactly.
 * Editorial mode is where the AI needs guidance: no drape ref will be sent,
 * so the prompt has to describe pose freedom.
 */
function poseClause(poseMode: PoseMode, persona: ResolvedCastingMetadata["persona"]): string {
  if (poseMode === "studio") return "";
  return (
    `Editorial framing: vary pose and composition to suit a ${personaText(persona)} moment ` +
    `(natural stance, subtle movement, side or three-quarter angles are welcome — avoid rigid front-facing catalogue pose).`
  );
}

/**
 * Compose the full casting suffix. Order matters: appearance first (the
 * generator anchors identity while the framing tokens are still fresh), then
 * style direction, then pose freedom. Suffix is empty-safe — a fully-null
 * brief still yields text because smart-pick fills every appearance field.
 */
export function renderCastingSuffix(
  metadata: ResolvedCastingMetadata,
  poseMode: PoseMode
): string {
  const parts: string[] = [
    appearanceClause(metadata),
    `Style direction: ${personaText(metadata.persona)}.`,
    poseClause(poseMode, metadata.persona),
  ].filter(Boolean);
  return parts.join(" ");
}

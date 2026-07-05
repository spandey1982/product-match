/**
 * Negative Prompt Library — first-class, reusable constraint set.
 *
 * Gemini image generation (`generateContent`) has no separate negative-prompt
 * parameter, so these constraints are appended as one instructive sentence in
 * the SAME request — no extra AI call, no extra cost. Kept as a library
 * (rather than embedded per-scene) so every scene inherits the same baseline
 * guarantees and only adds what's specific to it.
 */

/** Applies to every Scenic Collection generation, regardless of scene. */
export const CORE_NEGATIVE_CONSTRAINTS: string[] = [
  "the product/garment remains the clear hero of the image",
  "no additional people",
  "no crowd",
  "no oversized decorations obscuring the model or garment",
  "no distracting foreground objects",
  "no text",
  "no banners",
  "no logos",
  "no watermark",
  "clothing fully visible and unobstructed",
  "realistic, physically plausible composition",
  "authentic catalogue photography, not illustration or CGI",
];

/** Join the core constraints with any scene-specific extras into one clause. */
export function buildNegativeClause(extra: string[] = []): string {
  const all = [...CORE_NEGATIVE_CONSTRAINTS, ...extra];
  return `Do not include: ${all.join("; ")}.`;
}

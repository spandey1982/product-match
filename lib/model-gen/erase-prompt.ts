/**
 * Prompt for a targeted region edit (erase/fix-region feature).
 *
 * Deliberately doesn't rely on the model perfectly respecting the mask
 * boundary — lib/model-gen/erase.ts composites the result against the
 * original using the mask afterward, which is what actually guarantees
 * everything outside the masked region stays untouched. This prompt's job
 * is only to guide what gets drawn INSIDE the region.
 */
export interface ErasePromptInput {
  correctionText: string;
  /** Label of the retailer's chosen part-image reference (e.g. "Border"), when one was picked. */
  referenceLabel?: string | null;
}

/**
 * "Remove this" and "restyle this" need different instructions — a generic
 * correction clause reads as "keep the same shape/structure, just adjust its
 * look," which is the wrong default for a removal ask (2026-08-11 retailer
 * test: masking a duplicated pallu panel with "it's extra, not required"
 * only lightly retouched its trim/texture — the panel itself survived,
 * because nothing told the model the whole structure should disappear).
 */
const REMOVAL_INTENT = /\b(remove|delete|erase|extra|shouldn'?t|should not|unwanted|get rid|duplicate|redundant|not required|not needed|too many)\b/i;

export function buildErasePrompt(input: ErasePromptInput): string {
  const bits: string[] = [
    "This is a previously generated catalogue photo (Image 1) that needs one targeted correction.",
    "Image 2 is a black-and-white mask: the WHITE area marks exactly the region to change; everywhere else must read as unchanged — same pose, background, lighting and fabric as Image 1.",
    "Whatever you draw inside the masked region must match the exact studio lighting, shadow direction, floor/background tone and color grade of the surrounding unmasked area — the edit must be seamless, with no visible seam, color shift or brightness mismatch at the boundary.",
  ];
  if (input.referenceLabel) {
    bits.push(
      `Image 3 is a real reference photo of "${input.referenceLabel}" — reproduce its content faithfully inside the masked region, adapted to the drape, lighting and perspective already established in Image 1.`
    );
  }
  const correction = input.correctionText.trim();
  if (correction) bits.push(`Retailer's correction: "${correction}"`);
  if (correction && REMOVAL_INTENT.test(correction)) {
    bits.push(
      "This is a REMOVAL, not a restyle: erase the masked content completely — do not just adjust its color, pattern or texture while leaving its shape or structure in place. Replace it with whatever would plausibly be there instead (continuing background, the model's body, or the garment's own fabric/drape continuing naturally), matching the lighting, perspective and drape already established in Image 1. Also remove any shadow, reflection or highlight the removed content was casting, wherever it falls within the masked area — a removed object's shadow left behind reads as an obvious leftover."
    );
  }
  bits.push("Only change what is inside the white masked region — leave everything outside it exactly as it is.");
  return bits.join(" ");
}

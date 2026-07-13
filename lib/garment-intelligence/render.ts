/**
 * Garment Intelligence → prompt fragment renderer.
 *
 * Pure + deterministic (same intelligence → same string, no AI call): converts
 * the structured analysis into the dense natural-language paragraph the image
 * generator consumes through the existing `detailNotes` channel.
 *
 * Priority order is deliberate and matches the R&D finding that fidelity of
 * SURFACE WORK is what generations lose first: surface techniques + close-up
 * region evidence render first and fullest; pattern layout next; texture and
 * construction last and tersest. Budgeted so the fragment stays a helpful
 * hint, not a prompt takeover.
 */
import type { GarmentIntelligence, SurfaceTechnique } from "./types";

/** Hard cap on the rendered fragment (chars). */
const MAX_LENGTH = 900;

function renderTechnique(t: SurfaceTechnique): string {
  const bits: string[] = [];
  const density = t.density && t.density !== "medium" ? `${t.density} ` : "";
  const placement = t.placement ? ` across the ${t.placement}` : "";
  bits.push(`${density}${t.type}${placement}`);
  if (t.relief && t.relief !== "flat") bits.push(`${t.relief} relief above the base fabric`);
  if (t.colors.length > 0) bits.push(`in ${t.colors.slice(0, 3).join(" and ")} thread`);
  if (t.stitchCharacteristics) bits.push(t.stitchCharacteristics);
  return bits.join(", ");
}

/**
 * Render the fragment fed into buildViewPrompt's detailNotes. Returns "" for
 * an intelligence with nothing worth saying (extremely plain garment).
 */
export function renderPromptNotes(gi: GarmentIntelligence): string {
  const sentences: string[] = [];

  // 1. Surface techniques — the fidelity-critical core.
  if (gi.surfaceTechniques.length > 0) {
    const rendered = gi.surfaceTechniques.slice(0, 3).map(renderTechnique).filter(Boolean);
    if (rendered.length > 0) sentences.push(`Surface work: ${rendered.join("; ")}`);
  }

  // 2. Close-up region evidence — stitch-level physical truth from pass 2.
  const regionDetails = gi.regions
    .map((r) => r.detail)
    .filter(Boolean)
    .slice(0, 2);
  if (regionDetails.length > 0) {
    sentences.push(`At close range: ${regionDetails.join("; ")}`);
  }

  // 3. The handcrafted contract — the single most important rendering
  //    instruction when any technique is dimensional.
  const dimensional =
    gi.craftsmanship.handcrafted ||
    gi.surfaceTechniques.some((t) => t.handcrafted || (t.relief && t.relief !== "flat"));
  if (dimensional) {
    sentences.push(
      "Every embellishment is physically stitched and sits raised above the fabric casting fine shadows — dimensional handcrafted work, absolutely not a flat printed pattern"
    );
  }

  // 4. Pattern structure.
  const patternBits: string[] = [];
  if (gi.pattern.motifs.length > 0) patternBits.push(gi.pattern.motifs.slice(0, 4).join(", "));
  if (gi.pattern.layout) patternBits.push(`laid out ${gi.pattern.layout}`);
  if (gi.pattern.scale) patternBits.push(`${gi.pattern.scale} scale`);
  if (patternBits.length > 0) sentences.push(`Motifs: ${patternBits.join(", ")}`);

  // 5. Craftsmanship highlights the generator must not lose.
  if (gi.craftsmanship.highlights.length > 0) {
    sentences.push(`Must preserve: ${gi.craftsmanship.highlights.slice(0, 4).join("; ")}`);
  }

  // 6. Texture + construction — brief, lowest priority.
  const textureBits = [gi.texture.baseFabric, gi.texture.finish, gi.texture.drape].filter(Boolean);
  if (textureBits.length > 0) sentences.push(`Fabric: ${textureBits.join(", ")}`);
  const constructionBits = [
    gi.construction.silhouette,
    gi.construction.neckline,
    ...gi.construction.details.slice(0, 2),
  ].filter(Boolean);
  if (constructionBits.length > 0) sentences.push(`Construction: ${constructionBits.join(", ")}`);

  let out = sentences.join(". ");
  if (out) out += ".";
  if (out.length > MAX_LENGTH) {
    // Trim whole sentences from the end, never mid-sentence.
    while (out.length > MAX_LENGTH && sentences.length > 1) {
      sentences.pop();
      out = sentences.join(". ") + ".";
    }
    if (out.length > MAX_LENGTH) out = out.slice(0, MAX_LENGTH - 1) + ".";
  }
  return out;
}

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
import type { BackIntelligence, GarmentIntelligence, SurfaceTechnique } from "./types";

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
 *
 * Two tiers: MANDATORY sentences (surface work, close-up evidence, the
 * handcrafted contract, and garment length/sleeves — the generation-critical
 * facts) always survive; OPTIONAL sentences (pattern, highlights, texture,
 * remaining construction) are trimmed from the end when over budget.
 */
export function renderPromptNotes(gi: GarmentIntelligence): string {
  const mandatory: string[] = [];
  const optional: string[] = [];

  // 1. Surface techniques — the fidelity-critical core.
  if (gi.surfaceTechniques.length > 0) {
    const rendered = gi.surfaceTechniques.slice(0, 3).map(renderTechnique).filter(Boolean);
    if (rendered.length > 0) mandatory.push(`Surface work: ${rendered.join("; ")}`);
  }

  // 2. Close-up region evidence — stitch-level physical truth from pass 2.
  const regionDetails = gi.regions
    .map((r) => r.detail)
    .filter(Boolean)
    .slice(0, 2);
  if (regionDetails.length > 0) {
    mandatory.push(`At close range: ${regionDetails.join("; ")}`);
  }

  // 3. The handcrafted contract — the single most important rendering
  //    instruction when any technique is dimensional.
  const dimensional =
    gi.craftsmanship.handcrafted ||
    gi.surfaceTechniques.some((t) => t.handcrafted || (t.relief && t.relief !== "flat"));
  if (dimensional) {
    mandatory.push(
      "Every embellishment is physically stitched and sits raised above the fabric casting fine shadows — dimensional handcrafted work, absolutely not a flat printed pattern"
    );
  }

  // 4. Garment structure — length + sleeves are generation-critical (there is
  //    no universal kurta length; generations routinely invent one) so they
  //    render as exact requirements, never trimmed.
  const structureBits: string[] = [];
  if (gi.construction.length) structureBits.push(`the garment ends exactly ${gi.construction.length}`);
  if (gi.construction.sleeves) structureBits.push(`${gi.construction.sleeves} exactly as shown`);
  if (structureBits.length > 0) {
    mandatory.push(`Length and sleeves: ${structureBits.join(", ")} — reproduce both precisely, never longer or shorter`);
  }

  // 5. Pattern structure.
  const patternBits: string[] = [];
  if (gi.pattern.motifs.length > 0) patternBits.push(gi.pattern.motifs.slice(0, 4).join(", "));
  if (gi.pattern.layout) patternBits.push(`laid out ${gi.pattern.layout}`);
  if (gi.pattern.scale) patternBits.push(`${gi.pattern.scale} scale`);
  if (patternBits.length > 0) optional.push(`Motifs: ${patternBits.join(", ")}`);

  // 6. Craftsmanship highlights the generator must not lose.
  if (gi.craftsmanship.highlights.length > 0) {
    optional.push(`Must preserve: ${gi.craftsmanship.highlights.slice(0, 4).join("; ")}`);
  }

  // 7. Texture + remaining construction — brief, lowest priority.
  const textureBits = [gi.texture.baseFabric, gi.texture.finish, gi.texture.drape].filter(Boolean);
  if (textureBits.length > 0) optional.push(`Fabric: ${textureBits.join(", ")}`);
  const constructionBits = [
    gi.construction.silhouette,
    gi.construction.neckline,
    ...gi.construction.details.slice(0, 2),
  ].filter(Boolean);
  if (constructionBits.length > 0) optional.push(`Construction: ${constructionBits.join(", ")}`);

  const compose = (opt: string[]) => {
    const all = [...mandatory, ...opt];
    return all.length > 0 ? all.join(". ") + "." : "";
  };

  let kept = optional;
  let out = compose(kept);
  // Trim whole OPTIONAL sentences from the end, never mandatory ones.
  while (out.length > MAX_LENGTH && kept.length > 0) {
    kept = kept.slice(0, -1);
    out = compose(kept);
  }
  if (out.length > MAX_LENGTH) out = out.slice(0, MAX_LENGTH - 1) + ".";
  return out;
}

/**
 * Render the BACK-view fragment from a real back-image analysis. Always ends
 * with the no-front-copy guard — the analyzed truth plus the instruction is
 * stronger than either alone.
 */
export function renderBackPromptNotes(back: BackIntelligence): string {
  const bits: string[] = [];
  if (back.plain) {
    bits.push("The back of the garment is plain, unadorned fabric");
  } else if (back.design) {
    bits.push(`The back of the garment shows: ${back.design}`);
    if (back.techniques.length > 0) bits.push(`back surface work: ${back.techniques.slice(0, 3).join(", ")}`);
  }
  if (back.neckline) bits.push(`back neckline: ${back.neckline}`);
  bits.push(
    "Never duplicate the front neckline, yoke, placket or chest ornamentation on the back"
  );
  return bits.join(". ") + ".";
}

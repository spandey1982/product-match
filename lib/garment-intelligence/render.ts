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
import type {
  BackIntelligence,
  GarmentIntelligence,
  RegionObservation,
  SareeStructure,
  SurfaceTechnique,
} from "./types";

/**
 * Hard cap on the rendered fragment (chars). A ceiling, not a floor — a
 * GarmentIntelligence that doesn't populate the saree/v3 fields (every
 * non-saree category, and saree products before re-analysis) renders
 * exactly as long as before this was raised from 900.
 */
const MAX_LENGTH = 1300;

/**
 * The length/sleeves requirement sentence. Shared VERBATIM by the front and
 * back prompt fragments — front and back are two independent generations that
 * never see each other, so identical prompt text is the only mechanism that
 * keeps hem and sleeve length consistent across the set.
 */
function structureClause(gi: GarmentIntelligence): string {
  const bits: string[] = [];
  if (gi.construction.length) bits.push(`the garment ends exactly ${gi.construction.length}`);
  if (gi.construction.sleeves) bits.push(`${gi.construction.sleeves} exactly as shown`);
  return bits.length > 0
    ? `Length and sleeves: ${bits.join(", ")} — reproduce both precisely, never longer or shorter`
    : "";
}

function renderTechnique(t: SurfaceTechnique): string {
  const bits: string[] = [];
  const density = t.density && t.density !== "medium" ? `${t.density} ` : "";
  const placement = t.placement ? ` across the ${t.placement}` : "";
  bits.push(`${density}${t.type}${placement}`);
  if (t.relief && t.relief !== "flat") bits.push(`${t.relief} relief above the base fabric`);
  if (t.colors.length > 0) bits.push(`in ${t.colors.slice(0, 3).join(" and ")} thread`);
  if (t.stitchCharacteristics) bits.push(t.stitchCharacteristics);
  if (t.materialComposition.length > 0) bits.push(`combining ${t.materialComposition.slice(0, 3).join(", ")}`);
  return bits.join(", ");
}

/**
 * True when a retailer-UPLOADED macro (pass 2's best evidence, not the
 * model's own whole-image guess) reports raised/applied construction for
 * content overlapping this technique — contradicting an overview-pass
 * "woven-in" read. analyze.ts's own regionPrompt already tells the model
 * "this close-up is your best evidence for this judgment; use it even if
 * the overview pass already guessed" — but nothing previously enforced that
 * once both passes came back, so a confidently wrong "do not add raised
 * texture" instruction could reach the generator even when the retailer's
 * own macro showed the opposite (2026-08-09 bug report: a scattered buti the
 * overview called "woven, correctly flat" was, per the retailer's own
 * close-up upload, dense raised embroidery standing 1-2mm proud of the
 * fabric). Only upload-sourced regions count — a model-proposed ROI crop
 * isn't stronger evidence than the pass that already guessed.
 */
function contradictedByRegionEvidence(t: SurfaceTechnique, regions: RegionObservation[]): boolean {
  const words = `${t.type} ${t.placement}`
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  if (words.length === 0) return false;
  return regions.some((r) => {
    if (r.source !== "upload") return false;
    const raised =
      r.relief === "raised" || r.relief === "layered" || /appli|stitch|embroider|beadwork|stonework/i.test(r.constructionMethod);
    if (!raised) return false;
    const haystack = `${r.label} ${r.motif} ${r.detail} ${r.technique}`.toLowerCase();
    return words.some((w) => haystack.includes(w));
  });
}

/**
 * A photo alone can't reliably tell "genuinely flat" from "raised but lit
 * flat" — the technique's physical construction can. Keyword classification
 * of the free-text constructionMethod field (deliberately not an enum at
 * extraction time — see types.ts — so classification lives here instead).
 * `regions` lets a "woven-in" read get overridden by contradicting close-up
 * evidence — see contradictedByRegionEvidence above.
 */
function classifyConstructionMethod(
  t: SurfaceTechnique,
  regions: RegionObservation[]
): "woven-in" | "applied-on" | "unknown" {
  const s = t.constructionMethod.toLowerCase();
  if (!s) return "unknown";
  if (/applied|stitched|embroider|appliqu|stonework|beadwork/.test(s)) return "applied-on";
  if (/woven|jacquard|brocade/.test(s)) return contradictedByRegionEvidence(t, regions) ? "unknown" : "woven-in";
  return "unknown";
}

/**
 * Dimensional-contract clauses, construction-method-aware. Replaces the old
 * blanket "everything is raised" assumption, which actively pushed
 * authentic woven jacquard/brocade toward looking wrong (Sample 7,
 * docs/research/SAREE_ANATOMY_TAXONOMY.md) — a technique woven into the
 * fabric structure is correctly flat; only applied-on techniques
 * (embroidery, appliqué, stitched thread, stonework) are genuinely raised
 * regardless of how the photo happens to be lit.
 *
 * Full backward compatibility: when no technique has a populated
 * constructionMethod (pre-v3 cached data, or the model didn't return it),
 * falls back to the EXACT original heuristic.
 */
function dimensionalContractClauses(gi: GarmentIntelligence): string[] {
  const classify = (t: SurfaceTechnique) => classifyConstructionMethod(t, gi.regions);
  const appliedOn = gi.surfaceTechniques.filter((t) => classify(t) === "applied-on");
  const wovenIn = gi.surfaceTechniques.filter((t) => classify(t) === "woven-in");
  const unknown = gi.surfaceTechniques.filter((t) => classify(t) === "unknown");

  if (appliedOn.length === 0 && wovenIn.length === 0) {
    const dimensional =
      gi.craftsmanship.handcrafted || unknown.some((t) => t.handcrafted || (t.relief && t.relief !== "flat"));
    return dimensional
      ? [
          "Every embellishment is physically stitched and sits raised above the fabric casting fine shadows — dimensional handcrafted work, absolutely not a flat printed pattern",
        ]
      : [];
  }

  const clauses: string[] = [];
  if (appliedOn.length > 0) {
    clauses.push(
      `The following are physically stitched and raised above the fabric, casting fine shadows — dimensional handcrafted work, absolutely not flat printed patterns: ${appliedOn
        .map((t) => t.type)
        .slice(0, 3)
        .join(", ")}`
    );
  }
  if (wovenIn.length > 0) {
    clauses.push(
      `The following are woven into the fabric structure itself and correctly render relatively flat — do not add embroidered-style raised texture: ${wovenIn
        .map((t) => t.type)
        .slice(0, 3)
        .join(", ")}`
    );
  }
  if (unknown.some((t) => t.handcrafted || (t.relief && t.relief !== "flat"))) {
    clauses.push("Additional embellishment beyond the above is also physically stitched and raised, not flat printed");
  }
  return clauses;
}

function layeredReliefClauses(gi: GarmentIntelligence): string[] {
  return gi.surfaceTechniques
    .filter((t) => t.physicallyLayered && t.layeringNote)
    .slice(0, 2)
    .map(
      (t) =>
        `${t.type} is physically stacked layers with real cumulative thickness (${t.layeringNote}) — not a single flat layer of relief`
    );
}

function explicitAbsenceClause(gi: GarmentIntelligence): string {
  const items = gi.explicitAbsences.slice(0, 3);
  return items.length > 0 ? `Confirmed absent — do not add: ${items.join("; ")}` : "";
}

function renderBorderStructure(s: SareeStructure): string {
  const clauses = s.borders
    .map((b) => {
      const edgeLabel = b.edge === "unspecified" ? "A border" : `The ${b.edge} border`;
      let body = "";
      if (b.subBands.length > 0) {
        body = [...b.subBands]
          .sort((x, y) => x.order - y.order)
          .map((sb) => sb.description)
          .filter(Boolean)
          .join(", then ");
      } else if (b.design) {
        body = b.design;
      }
      if (!body) return "";
      const addition = b.edgeAddition ? ` — with ${b.edgeAddition} on this edge` : "";
      return `${edgeLabel}: ${body}${addition}`;
    })
    .filter(Boolean);
  return clauses.join(". ");
}

function renderButiPopulations(s: SareeStructure): string {
  const clauses = s.butiPopulations
    .slice(0, 4)
    .map((b) => {
      const bits: string[] = [b.label || b.motif || "buti"];
      if (b.placementZone) bits.push(b.placementZone);
      if (b.axis === "perpendicular") bits.push("running across the width, border to border");
      else if (b.axis === "parallel") bits.push("running along the length, parallel to the pallu");
      if (b.patternType === "continuous") {
        bits.push(
          "a continuous connected pattern, not a repeatable stamped motif — any close-up of it is texture reference only, never a layout unit"
        );
      }
      return bits.join(" — ");
    })
    .filter(Boolean);
  return clauses.join(". ");
}

function renderColorStructure(s: SareeStructure): string {
  if (!s.hardSplit || s.colorZones.length === 0) return "";
  const zones = s.colorZones
    .slice(0, 4)
    .map((z) => [z.label, z.colorMechanism, z.decorativeOverrideNote].filter(Boolean).join(", "))
    .filter(Boolean);
  if (zones.length === 0) return "";
  return `This saree has a hard color-line split — the whole width changes color together at one point along the length (not a gradient). Zones: ${zones.join("; ")}`;
}

function renderPalluRelationship(s: SareeStructure): string {
  const bits: string[] = [];
  if (s.palluRelationship === "same-rotated") {
    bits.push("the pallu carries the same design as the border, turned 90° at the corner");
  } else if (s.palluRelationship === "boxed-nested") {
    bits.push("the border continues as a frame around the pallu, which carries its own distinct interior design");
  } else if (s.palluRelationship === "independent") {
    bits.push("the pallu design is independent of the border");
  }
  if (s.palluContent) bits.push(`pallu content: ${s.palluContent}`);
  if (s.palluTassels) bits.push(s.palluTassels);
  return bits.join(". ");
}

function renderPalluCornerTreatment(s: SareeStructure): string {
  return s.palluCornerTreatment ? `Corner where pallu meets border: ${s.palluCornerTreatment}` : "";
}

/**
 * Render the fragment fed into buildViewPrompt's detailNotes. Returns "" for
 * an intelligence with nothing worth saying (extremely plain garment).
 *
 * Three tiers:
 * - `core`: never trimmed, kept deliberately small (surface work summary,
 *   the construction-method-aware dimensional contract, garment
 *   length/sleeves, confirmed absences, and the pallu/border relationship)
 *   — the generation-critical facts this feature exists to protect. Pallu
 *   relationship joined core after the 2026-08-09 bug report: it had been a
 *   `priority` entry, trimmed away whenever the (much longer) region-detail
 *   dump ate the budget first — the exact case that let a generator invent
 *   a pallu design GI had already confirmed didn't exist.
 * - `priority`: an ORDERED list, highest-priority-first, trimmed from the
 *   low-priority end when over budget. Buti-population and border-structure
 *   facts sit highest (misplacement here is a directly-reported bug); the
 *   raw region-detail dump sits LOWEST — it's the most verbose entry per
 *   fact conveyed and every fact worth keeping from it is already distilled
 *   into the structured fields above it, so it's the correct thing to lose
 *   first when the budget is tight, never the structured facts.
 * - A raw char-slice is kept only as a final safety fallback; with `core`
 *   kept small it should essentially never fire.
 */
export function renderPromptNotes(gi: GarmentIntelligence): string {
  const core: string[] = [];
  const priority: string[] = [];

  // Surface techniques — the fidelity-critical summary.
  if (gi.surfaceTechniques.length > 0) {
    const rendered = gi.surfaceTechniques.slice(0, 3).map(renderTechnique).filter(Boolean);
    if (rendered.length > 0) core.push(`Surface work: ${rendered.join("; ")}`);
  }

  // The dimensional contract — construction-method-aware (§ above).
  core.push(...dimensionalContractClauses(gi));

  // Garment structure — length + sleeves are generation-critical.
  const structure = structureClause(gi);
  if (structure) core.push(structure);

  // Confirmed absences — silence is not the same as "confirmed absent";
  // short and load-bearing, kept in core.
  const absence = explicitAbsenceClause(gi);
  if (absence) core.push(absence);

  const s = gi.sareeStructure;
  if (s) {
    // Pallu/border relationship — core, not priority (see doc comment above).
    const palluRel = renderPalluRelationship(s);
    if (palluRel) core.push(palluRel);

    const buti = renderButiPopulations(s);
    if (buti) priority.push(buti);
    const borders = renderBorderStructure(s);
    if (borders) priority.push(borders);
    const colorStructure = renderColorStructure(s);
    if (colorStructure) priority.push(colorStructure);
  }

  priority.push(...layeredReliefClauses(gi));

  // Pattern structure.
  const patternBits: string[] = [];
  if (gi.pattern.motifs.length > 0) patternBits.push(gi.pattern.motifs.slice(0, 4).join(", "));
  if (gi.pattern.layout) patternBits.push(`laid out ${gi.pattern.layout}`);
  if (gi.pattern.scale) patternBits.push(`${gi.pattern.scale} scale`);
  if (patternBits.length > 0) priority.push(`Motifs: ${patternBits.join(", ")}`);

  // Craftsmanship highlights the generator must not lose.
  if (gi.craftsmanship.highlights.length > 0) {
    priority.push(`Must preserve: ${gi.craftsmanship.highlights.slice(0, 4).join("; ")}`);
  }

  // Texture + remaining construction — brief.
  const textureBits = [gi.texture.baseFabric, gi.texture.finish, gi.texture.drape].filter(Boolean);
  if (textureBits.length > 0) priority.push(`Fabric: ${textureBits.join(", ")}`);
  const constructionBits = [
    gi.construction.silhouette,
    gi.construction.neckline,
    ...gi.construction.details.slice(0, 2),
  ].filter(Boolean);
  if (constructionBits.length > 0) priority.push(`Construction: ${constructionBits.join(", ")}`);

  // Pallu corner treatment — real but secondary.
  if (s) {
    const corner = renderPalluCornerTreatment(s);
    if (corner) priority.push(corner);
  }

  // Close-up region evidence, verbatim — stitch-level physical truth from
  // pass 2, but the most verbose entry per fact conveyed (raw paragraphs,
  // not distilled sentences) and the LEAST likely to be missed if trimmed:
  // every fact worth keeping from it is already distilled into the
  // structured fields above (surface work, dimensional contract, buti/
  // border structure, pallu relationship). Pushed last so it's first to go
  // under budget pressure, never a structured fact in its place.
  const regionDetails = gi.regions
    .map((r) => r.detail)
    .filter(Boolean)
    .slice(0, 2);
  if (regionDetails.length > 0) {
    priority.push(`At close range: ${regionDetails.join("; ")}`);
  }

  const compose = (kept: string[]) => {
    const all = [...core, ...kept];
    return all.length > 0 ? all.join(". ") + "." : "";
  };

  let kept = priority;
  let out = compose(kept);
  // Trim whole PRIORITY sentences from the low-priority end, never core ones.
  while (out.length > MAX_LENGTH && kept.length > 0) {
    kept = kept.slice(0, -1);
    out = compose(kept);
  }
  if (out.length > MAX_LENGTH) out = out.slice(0, MAX_LENGTH - 1) + ".";
  return out;
}

/**
 * Render the BACK-view fragment from a real back-image analysis. Includes the
 * same structure (length/sleeves) sentence as the front fragment — the two
 * views are independent generations, so shared text is what keeps them
 * consistent — and always ends with the no-front-copy guard: the analyzed
 * truth plus the instruction is stronger than either alone.
 */
export function renderBackPromptNotes(back: BackIntelligence, gi: GarmentIntelligence): string {
  const bits: string[] = [];
  if (back.plain) {
    bits.push("The back of the garment is plain, unadorned fabric");
  } else if (back.design) {
    bits.push(`The back of the garment shows: ${back.design}`);
    if (back.techniques.length > 0) bits.push(`back surface work: ${back.techniques.slice(0, 3).join(", ")}`);
  }
  if (back.neckline) bits.push(`back neckline: ${back.neckline}`);
  const structure = structureClause(gi);
  if (structure) bits.push(structure);
  bits.push(
    "Never duplicate the front neckline, yoke, placket or chest ornamentation on the back"
  );
  return bits.join(". ") + ".";
}

/**
 * Back-view fragment when NO back image exists: the plain-or-continues guard
 * plus the SAME structure sentence the front fragment carries. Without this,
 * a back view generated from an unphotographed back had no length/sleeve
 * information at all while the front did — the exact recipe for a set whose
 * two views disagree about sleeve length.
 */
export function renderBackFallbackNotes(gi: GarmentIntelligence): string {
  const bits: string[] = [
    "The back of this garment is not photographed: render it plain or simply continuing the garment's overall body pattern",
  ];
  const structure = structureClause(gi);
  if (structure) bits.push(structure);
  bits.push(
    "Never duplicate the front neckline, yoke, placket or chest ornamentation on the back"
  );
  return bits.join(". ") + ".";
}

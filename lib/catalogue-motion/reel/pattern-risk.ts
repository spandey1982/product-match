/**
 * Pattern-fidelity risk assessment for reel jobs — reads Garment
 * Intelligence's real, vision-extracted embellishment density instead of
 * Product.pattern's coarse text. Confirmed necessary, not just theoretical:
 * a saree that passed cleanly and a lehenga that partially failed on
 * pattern-fidelity grounds were BOTH tagged pattern="Embroidered" — that
 * field cannot distinguish a simple scattered motif from dense all-over
 * mirror-work. GI's `craftsmanship.overallDensity` and per-technique
 * `density` fields can: "medium"/"scattered" for the saree that passed,
 * "dense"/"all-over" (two stacked techniques) for the lehenga that didn't
 * (live-tested 2026-09-06, see research/reel-engine-components.html,
 * Component 9).
 *
 * Deliberately GI-gated, not a fallback heuristic on Product.pattern: an
 * unreliable signal is worse than no signal, and this session confirmed
 * Product.pattern specifically IS unreliable for this one purpose. Products
 * without GI data get no risk assessment rather than a guess.
 */

interface ParsedSurfaceTechnique {
  density?: unknown;
}

interface ParsedGarmentIntelligence {
  craftsmanship?: { overallDensity?: unknown };
  surfaceTechniques?: ParsedSurfaceTechnique[];
}

export interface PatternRiskAssessment {
  highRisk: boolean;
  note: string | null;
}

const HIGH_DENSITY_VALUES = new Set(["dense", "heavy", "all-over"]);

/** `giDataJson` is the raw `GarmentIntelligence.data` string, or null when no GI row exists for the product. */
export function assessPatternRisk(giDataJson: string | null | undefined): PatternRiskAssessment {
  if (!giDataJson) return { highRisk: false, note: null };

  let data: ParsedGarmentIntelligence;
  try {
    data = JSON.parse(giDataJson);
  } catch {
    return { highRisk: false, note: null };
  }

  const overallDensity = String(data.craftsmanship?.overallDensity ?? "").toLowerCase();
  const allOverCount = (data.surfaceTechniques ?? []).filter(
    (t) => String(t.density ?? "").toLowerCase() === "all-over"
  ).length;

  const highRisk = HIGH_DENSITY_VALUES.has(overallDensity) || allOverCount >= 2;
  if (!highRisk) return { highRisk: false, note: null };

  const densityPart = overallDensity ? `overallDensity="${overallDensity}"` : "";
  const coveragePart = allOverCount > 0 ? `${allOverCount} all-over-coverage technique(s)` : "";
  const detail = [densityPart, coveragePart].filter(Boolean).join(", ");

  return {
    highRisk: true,
    note:
      `High pattern-fidelity risk per Garment Intelligence (${detail}) — motion intensity reduced to ` +
      `"minimal" for this reel. A QA rejection here, especially on a shot with real camera movement, may ` +
      `reflect a genuine generation-capability ceiling on dense embellishment, not a pipeline defect ` +
      `(research/reel-engine-components.html, Component 9). This does not fully eliminate the risk: a ` +
      `live test found even a fully static shot fail on pattern grounds for a sufficiently dense product.`,
  };
}

/**
 * Fabric-weight classification — single source of truth, shared by posing
 * (prompt-sets.ts's fabricPoseClause) and automatic Festive-scene decor
 * density (scenes/rule-engine.ts's densityFromMaterial). Reuses Product.material,
 * a real structured field (lib/metadata/analyze.ts's closed fabric list)
 * already populated at upload — see prompt-sets.ts's fabricPoseClause for the
 * original research rationale (research/why-it-looks-ai.html, point 02).
 */
const HEAVY_STRUCTURED_MATERIALS = new Set(["Silk", "Velvet", "Brocade", "Wool", "Satin", "Khadi"]);
const LIGHT_FLOWING_MATERIALS = new Set(["Chiffon", "Georgette", "Net", "Organza", "Muslin", "Crepe", "Viscose"]);

export type FabricWeight = "heavy" | "light" | "medium";

/** "medium" covers unlisted/mid-weight materials (Cotton, Linen, Polyester, …). */
export function classifyFabricWeight(material: string | null | undefined): FabricWeight {
  const m = material?.trim() ?? "";
  if (HEAVY_STRUCTURED_MATERIALS.has(m)) return "heavy";
  if (LIGHT_FLOWING_MATERIALS.has(m)) return "light";
  return "medium";
}

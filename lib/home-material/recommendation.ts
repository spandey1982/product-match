/**
 * Deterministic Recommendation Engine — "help me choose" mode (brief §8
 * Mode B). Scores every Material Knowledge entry against stated
 * requirements and explains why. Architecturally mirrors
 * lib/matching-engine/scorer.ts + explainer.ts's separation of concerns
 * (weighted deterministic scorer, separate explanation builder) — no code
 * shared with it, since that engine is protected fashion IP scoring
 * entirely different things (garment cross-sell, not material
 * suitability). Per the AI-boundaries rule, this is deterministic/hybrid
 * logic, never an LLM-invented score (Constitution, docs/home-material
 * README's AI boundaries table).
 */
import type { CostTier, MaintenanceLevel, MaterialCategory, MaterialTaxonomyEntry, MoistureLevel } from "./material-taxonomy";
import { MATERIAL_TAXONOMY } from "./material-taxonomy";

export type BudgetTier = CostTier | "any";
export type Priority = "durability" | "low_maintenance" | "premium_look" | "any";

export interface MaterialRequirements {
  wetArea: boolean;
  budgetTier: BudgetTier;
  priority: Priority;
  preferredCategory: MaterialCategory | "any";
}

export interface MaterialRecommendationResult {
  materialId: string;
  slug: string;
  name: string;
  category: MaterialCategory;
  score: number;
  confidence: number;
  reasons: string[];
  concerns: string[];
  explanation: string;
  /**
   * The four weighted components behind `score` (each 0–1, before its
   * WEIGHTS multiplier is applied) — added 2026-09-10 (Decision-layer
   * "why this recommendation" vocabulary, brief §37: explain a
   * recommendation rather than just showing a bare score). Not persisted
   * to HmRecommendation (no schema column for it) — only ever present on
   * a freshly-computed response, not after a GET restores a prior
   * persisted set from the database. That's a deliberate scope call: the
   * requirements a score was computed from aren't persisted anywhere
   * either, so a breakdown can't be honestly reconstructed after the
   * fact without them.
   */
  components: { moisture: number; budget: number; priority: number; category: number };
}

/** Exported so the UI can label each score-breakdown row with its real weight, rather than hardcoding a second copy of these numbers. */
export const WEIGHTS = {
  moisture: 0.35,
  budget: 0.25,
  priority: 0.3,
  category: 0.1,
};

const MOISTURE_SCORE: Record<MoistureLevel, number> = { excellent: 1.0, good: 0.75, fair: 0.4, poor: 0.1 };
const MAINTENANCE_SCORE: Record<MaintenanceLevel, number> = { low: 1.0, medium: 0.5, high: 0.15 };
const PREMIUM_LOOK_SCORE: Record<CostTier, number> = { budget: 0.3, mid: 0.65, premium: 1.0 };
const TIER_ORDER: CostTier[] = ["budget", "mid", "premium"];

function moistureFit(level: MoistureLevel, wetArea: boolean): number {
  // Moisture resistance only matters if the surface is actually in a
  // wet-prone area — an otherwise-great material shouldn't be penalized
  // for a factor that doesn't apply to this wall.
  return wetArea ? MOISTURE_SCORE[level] : 0.8;
}

function budgetFit(tier: CostTier, requested: BudgetTier): number {
  if (requested === "any") return 0.8;
  if (tier === requested) return 1.0;
  const diff = Math.abs(TIER_ORDER.indexOf(tier) - TIER_ORDER.indexOf(requested));
  return diff === 1 ? 0.5 : 0.15;
}

function durabilityFit(years: number): number {
  if (years >= 12) return 1.0;
  if (years >= 8) return 0.8;
  if (years >= 5) return 0.5;
  return 0.2;
}

function priorityFit(entry: MaterialTaxonomyEntry, priority: Priority): number {
  switch (priority) {
    case "durability":
      return durabilityFit(entry.durabilityYearsApprox);
    case "low_maintenance":
      return MAINTENANCE_SCORE[entry.maintenanceLevel];
    case "premium_look":
      return PREMIUM_LOOK_SCORE[entry.costTier];
    default:
      return 0.8;
  }
}

function categoryFit(category: MaterialCategory, preferred: MaterialCategory | "any"): number {
  if (preferred === "any") return 0.8;
  return category === preferred ? 1.0 : 0.3;
}

function buildExplanation(
  entry: MaterialTaxonomyEntry,
  requirements: MaterialRequirements,
  components: { moisture: number; budget: number; priority: number; category: number }
): { reasons: string[]; concerns: string[]; explanation: string } {
  const reasons: string[] = [];
  const concerns: string[] = [];

  if (requirements.wetArea) {
    if (components.moisture >= 0.7) reasons.push(`Suitable for a moisture-prone area (${entry.moistureLevel} moisture resistance)`);
    else if (components.moisture <= 0.4) concerns.push(`Moisture resistance is ${entry.moistureLevel} — a real concern for a wet-prone area`);
  }

  if (requirements.budgetTier !== "any") {
    if (components.budget >= 0.9) reasons.push(`Fits your ${requirements.budgetTier} budget`);
    else if (components.budget <= 0.2) concerns.push(`Priced outside your stated ${requirements.budgetTier} budget (this material is typically ${entry.costTier})`);
  }

  if (requirements.priority === "durability") {
    if (components.priority >= 0.8) reasons.push(`Durable — approx. ${entry.durabilityYearsApprox} years typical lifespan`);
    else if (components.priority <= 0.3) concerns.push(`Shorter typical lifespan (approx. ${entry.durabilityYearsApprox} years) for a durability priority`);
  } else if (requirements.priority === "low_maintenance") {
    if (components.priority >= 0.8) reasons.push("Low maintenance — easy to keep clean");
    else if (components.priority <= 0.3) concerns.push(`${entry.maintenanceLevel === "high" ? "High" : "Some"} maintenance needed — not the easiest option to keep low-effort`);
  } else if (requirements.priority === "premium_look") {
    if (components.priority >= 0.8) reasons.push("Matches your premium-look preference");
    else if (components.priority <= 0.4) concerns.push("More of a budget/practical option than a premium-look choice");
  }

  if (requirements.preferredCategory !== "any") {
    if (entry.category === requirements.preferredCategory) reasons.push(`Matches your preferred category (${requirements.preferredCategory.replace("_", " ")})`);
    else concerns.push(`Not your preferred category (you selected ${requirements.preferredCategory.replace("_", " ")})`);
  }

  if (reasons.length === 0) reasons.push("A reasonable general-purpose option for this wall");

  const explanation = reasons.map((r) => `✓ ${r}`).concat(concerns.map((c) => `⚠ ${c}`)).join("\n");

  return { reasons, concerns, explanation };
}

export function scoreMaterial(
  entry: MaterialTaxonomyEntry,
  requirements: MaterialRequirements
): MaterialRecommendationResult {
  const components = {
    moisture: moistureFit(entry.moistureLevel, requirements.wetArea),
    budget: budgetFit(entry.costTier, requirements.budgetTier),
    priority: priorityFit(entry, requirements.priority),
    category: categoryFit(entry.category, requirements.preferredCategory),
  };

  const score =
    WEIGHTS.moisture * components.moisture +
    WEIGHTS.budget * components.budget +
    WEIGHTS.priority * components.priority +
    WEIGHTS.category * components.category;

  const confidence = Math.min(0.95, score * 1.05);
  const { reasons, concerns, explanation } = buildExplanation(entry, requirements, components);

  return {
    materialId: `hm_material_${entry.slug}`,
    slug: entry.slug,
    name: entry.name,
    category: entry.category,
    score: Math.round(score * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    reasons,
    concerns,
    explanation,
    components: {
      moisture: Math.round(components.moisture * 100) / 100,
      budget: Math.round(components.budget * 100) / 100,
      priority: Math.round(components.priority * 100) / 100,
      category: Math.round(components.category * 100) / 100,
    },
  };
}

export function generateMaterialRecommendations(
  requirements: MaterialRequirements,
  limit = 6
): MaterialRecommendationResult[] {
  return MATERIAL_TAXONOMY.map((entry) => scoreMaterial(entry, requirements))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

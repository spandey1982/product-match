/**
 * Smart match — deterministic backdrop recommendation (Phase 3).
 *
 * Given a product's signals, score every backdrop and return the best. The goal
 * is a backdrop that makes the garment the hero: enough colour contrast that the
 * product pops, while leaning to neutral, premium studios as the safe default.
 *
 * Cost philosophy: NO AI call. Scoring reuses the existing color-harmony engine
 * (lib/matching-engine) — the same IP that powers product recommendations — so
 * garment↔backdrop pairing is grounded in rules the platform already trusts.
 * Pure and deterministic: same signals → same pick.
 *
 * Extensible by design: add a preset (with `matchColor` / `neutral`) and it
 * enters scoring automatically; richer signals (pattern, brightness, category)
 * are already threaded through `SmartMatchSignals` for future weighting.
 */
import { getColorCompatibility } from "@/lib/matching-engine/color-harmony";
import {
  BACKDROP_PRESETS,
  DEFAULT_BACKDROP_PRESET_ID,
  getBackdropPreset,
  type BackdropPreset,
} from "./backdrops";

export interface SmartMatchSignals {
  /** Dominant garment colour (e.g. "Maroon", "Royal Blue"). The primary signal. */
  color?: string | null;
  /** Apparel category — reserved for future weighting (e.g. bridal → richer). */
  category?: string | null;
  /** Pattern/print density — reserved for future weighting. */
  pattern?: string | null;
}

export interface BackdropScore {
  preset: BackdropPreset;
  /** 0–1 compatibility score; higher is a better backdrop for this product. */
  score: number;
  /** Short, human-readable rationale (explainability). */
  reason: string;
}

const NEUTRAL_BOOST = 0.12; // neutral studios are safe + premium
const TONAL_PENALTY = 0.4; // tinted studio too close to the garment → washes out
const POP_BONUS = 0.05; // complementary/festive pairing makes the garment pop

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** On ties, the benchmark (Boutique Beige) wins — a stable, premium default. */
function tieBreak(a: BackdropScore, b: BackdropScore): number {
  if (a.preset.id === b.preset.id) return 0;
  if (a.preset.id === DEFAULT_BACKDROP_PRESET_ID) return -1;
  if (b.preset.id === DEFAULT_BACKDROP_PRESET_ID) return 1;
  return 0;
}

/** Score every backdrop for a product, best first. */
export function scoreBackdrops(signals: SmartMatchSignals): BackdropScore[] {
  const garment = (signals.color ?? "").trim();

  const scored: BackdropScore[] = BACKDROP_PRESETS.map((preset) => {
    // No colour signal yet → favour neutrals (and the benchmark) as safe picks.
    if (!garment) {
      const base = preset.neutral ? 0.6 : 0.4;
      const score = preset.id === DEFAULT_BACKDROP_PRESET_ID ? base + 0.05 : base;
      return { preset, score, reason: "No product colour — defaulting to a neutral studio" };
    }

    const harmony = getColorCompatibility(garment, preset.matchColor);
    let score = harmony.score;
    let reason = harmony.label;

    if (preset.neutral) {
      score += NEUTRAL_BOOST;
    } else if (harmony.type === "tonal") {
      // Tinted backdrop sharing the garment's family → low contrast, garment
      // disappears into it. Strongly deprioritise.
      score -= TONAL_PENALTY;
      reason = "Too close to the garment colour";
    }

    if (harmony.type === "complementary" || harmony.type === "festive") {
      score += POP_BONUS;
    }

    return { preset, score: clamp01(score), reason };
  });

  return scored.sort((a, b) => b.score - a.score || tieBreak(a, b));
}

/** The single best backdrop for a product (Smart match's recommendation). */
export function pickSmartBackdrop(signals: SmartMatchSignals): BackdropPreset {
  return scoreBackdrops(signals)[0]?.preset
    ?? getBackdropPreset(DEFAULT_BACKDROP_PRESET_ID)
    ?? BACKDROP_PRESETS[0];
}

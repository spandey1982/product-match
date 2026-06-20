/**
 * Look Builder — candidate generation.
 *
 * Given an anchor product and a catalog, resolve the anchor's look template into
 * ranked candidates per slot:
 *   1. SYSTEM decides the slots + which categories fill them (templates.ts).
 *   2. The matching engine RANKS the eligible products inside each slot.
 *
 * Pure and framework-independent: it takes the catalog as an argument and never
 * touches the database, so it is trivially testable and the DB query stays in
 * the (future) API/data layer. Ranking reuses lib/matching-engine/scorer.ts, so
 * scoring stays consistent with the rest of the app.
 */
import type { Product } from "@prisma/client";
import { scoreMatch } from "@/lib/matching-engine/scorer";
import { getLookTemplate, normalizeCategory } from "./templates";
import type { ResolvedLook, ResolvedSlot, SlotCandidate } from "./types";

const DEFAULT_PER_SLOT = 8;

/**
 * Whether a candidate's gender is compatible with the anchor's. UNISEX matches
 * anything; otherwise the genders must match (so a menswear look never suggests
 * womenswear and vice versa). Missing gender on either side is permissive.
 */
function genderCompatible(anchor: Product, candidate: Product): boolean {
  const a = anchor.gender?.trim().toUpperCase();
  const c = candidate.gender?.trim().toUpperCase();
  if (!a || !c) return true;
  if (a === "UNISEX" || c === "UNISEX") return true;
  return a === c;
}

export interface BuildLookOptions {
  /** Max ranked candidates returned per slot. Default 8. */
  perSlot?: number;
  /** Filter candidates by gender compatibility with the anchor. Default true. */
  enforceGender?: boolean;
}

/**
 * Build the ranked look for an anchor product against a catalog. Returns the
 * template (null if the anchor category has no look) and, for each slot, the
 * top candidates ranked by the matching engine's score.
 */
export function buildLook(
  anchor: Product,
  catalog: Product[],
  opts: BuildLookOptions = {}
): ResolvedLook {
  const perSlot = opts.perSlot ?? DEFAULT_PER_SLOT;
  const enforceGender = opts.enforceGender ?? true;

  const template = getLookTemplate(anchor.category);
  if (!template) return { anchor, template: null, slots: [] };

  const slots: ResolvedSlot[] = template.slots.map((slot) => {
    const candidates: SlotCandidate[] = catalog
      .filter(
        (p) =>
          p.id !== anchor.id &&
          p.isActive &&
          p.inStock &&
          slot.categories.includes(normalizeCategory(p.category)) &&
          (!enforceGender || genderCompatible(anchor, p))
      )
      .map((p) => {
        const score = scoreMatch(anchor, p);
        return {
          product: p,
          matchScore: score.matchScore,
          explanation: score.explanation,
          explanationTags: score.explanationTags,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, perSlot);

    return { slot, candidates };
  });

  return { anchor, template, slots };
}

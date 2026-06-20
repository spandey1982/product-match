/**
 * Look Builder — type definitions.
 *
 * A "look" is an anchor garment plus a set of SLOTS the system says complete it
 * (e.g. a Suit look has Shirt / Shoes / Tie / Belt slots). The system decides
 * WHICH categories may fill each slot; the matching engine only RANKS candidates
 * within a slot. This keeps category selection deterministic and explainable —
 * no AI-driven category guessing. See docs / look-builder-direction memory.
 */
import type { Product } from "@prisma/client";

/** A single fillable position in a look (e.g. "footwear", "tie"). */
export interface LookSlot {
  /** Unique within its template. */
  id: string;
  /** UI-facing label, e.g. "Shoes". */
  label: string;
  /**
   * Normalized candidate categories that can fill this slot (lowercase,
   * spaces→underscores). A slot may accept several (e.g. a kurta bottom can be
   * salwar OR palazzo).
   */
  categories: string[];
  /** Required slots are needed for a "complete" look; optional ones enhance it. */
  required: boolean;
  /** Max items the slot holds (almost always 1). */
  max: number;
}

/** The blueprint for an anchor category's complete look. */
export interface LookTemplate {
  /** Normalized anchor category, e.g. "suit". */
  anchor: string;
  /** UI-facing label, e.g. "Suit". */
  label: string;
  slots: LookSlot[];
}

/** A ranked candidate product for a slot, carrying the scorer's output. */
export interface SlotCandidate {
  product: Product;
  matchScore: number;
  explanation: string;
  explanationTags: string[];
}

/** A template slot resolved against a catalog into ranked candidates. */
export interface ResolvedSlot {
  slot: LookSlot;
  candidates: SlotCandidate[];
}

/** The full result of building a look around an anchor product. */
export interface ResolvedLook {
  anchor: Product;
  /** null when the anchor category has no template (no look to build). */
  template: LookTemplate | null;
  slots: ResolvedSlot[];
}

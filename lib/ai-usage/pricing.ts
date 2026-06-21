/**
 * AI provider pricing — the single source of truth for cost estimation.
 *
 * Estimates are computed at write time (lib/ai-usage/record.ts) and stamped with
 * PRICING_VERSION on each AiUsageEvent row, so historical estimates stay
 * reproducible. Because the raw drivers (tokens, image counts) are also stored,
 * any row can be re-priced later by bumping this table and recomputing.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ⚠  VERIFY THESE NUMBERS against the live Google pricing pages before     │
 * │    trusting cost reports. They are best-effort estimates, NOT contractual │
 * │    rates, and Google changes them. When you update a rate, bump           │
 * │    PRICING_VERSION so old rows remain attributable to the old prices.     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Billing model per provider (see the usage analysis):
 *   • Gemini text/vision models — billed per input + output token. Input images
 *     are tokenized and already counted in promptTokenCount.
 *   • Gemini image models — the generated image is billed as output tokens
 *     (candidatesTokenCount), so token rates cover it; do NOT also add a
 *     per-image charge or cost double-counts.
 *   • Vertex virtual-try-on — billed per generated image; reports no tokens.
 */

/** Bump whenever any rate below changes. Stamped onto every AiUsageEvent row. */
export const PRICING_VERSION = "2026-06-google-estimate";

export interface ModelPrice {
  /** USD per 1,000,000 input tokens. */
  inputPerMTok?: number;
  /** USD per 1,000,000 output tokens (image-gen output tokens count here). */
  outputPerMTok?: number;
  /** USD per generated image, for providers that bill per image (Vertex). */
  perImageUsd?: number;
}

/**
 * Per-model rates, keyed by the exact model id passed at the call site. Unknown
 * models return a null estimate (we never fabricate a price) — add an entry here
 * when integrating a new model.
 */
const PRICES: Record<string, ModelPrice> = {
  // Text / vision (token-billed)
  "gemini-2.5-flash": { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  "gemini-2.5-flash-lite": { inputPerMTok: 0.1, outputPerMTok: 0.4 },

  // Image generation (output image billed as output tokens)
  "gemini-3.1-flash-image": { inputPerMTok: 0.3, outputPerMTok: 30.0 },

  // Vertex Virtual Try-On (per generated image, no tokens reported)
  "virtual-try-on-001": { perImageUsd: 0.04 },
};

export interface CostDrivers {
  inputTokens?: number | null;
  outputTokens?: number | null;
  imagesGenerated?: number | null;
}

/**
 * Estimate the USD cost of one AI call from its billable drivers. Returns null
 * when the model has no known price, so callers can store an honest "unknown"
 * rather than a fabricated zero.
 */
export function estimateCostUsd(model: string, drivers: CostDrivers): number | null {
  const price = PRICES[model];
  if (!price) return null;

  let cost = 0;
  if (price.inputPerMTok && drivers.inputTokens) {
    cost += (drivers.inputTokens / 1_000_000) * price.inputPerMTok;
  }
  if (price.outputPerMTok && drivers.outputTokens) {
    cost += (drivers.outputTokens / 1_000_000) * price.outputPerMTok;
  }
  if (price.perImageUsd && drivers.imagesGenerated) {
    cost += drivers.imagesGenerated * price.perImageUsd;
  }
  return cost;
}

/** Whether we have a price entry for a model (useful for admin diagnostics). */
export function hasPrice(model: string): boolean {
  return model in PRICES;
}

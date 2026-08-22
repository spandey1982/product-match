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
export const PRICING_VERSION = "2026-08-08-verified-image-gen";

export interface ModelPrice {
  /** USD per 1,000,000 input tokens. */
  inputPerMTok?: number;
  /** USD per 1,000,000 output tokens (image-gen output tokens count here). */
  outputPerMTok?: number;
  /** USD per generated image, for providers that bill per image (Vertex). */
  perImageUsd?: number;
  /** USD per second of generated video, for video models (Veo). */
  perSecondUsd?: number;
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

  // Image generation (output image billed as output tokens). The selectable
  // "Nano Banana" family (lib/model-gen/image-gen-models.ts) — all four ids
  // below are confirmed real via the live ListModels endpoint (2026-08-02).
  //
  // gemini-3.1-flash-image (Nano Banana 2) — VERIFIED 2026-08-08 against
  // ai.google.dev/gemini-api/docs/pricing: output is $60/M tokens. The prior
  // placeholder here (30.0, i.e. half the real rate) was reconciled against a
  // real GCP bill: our own estimate for a day's testing came to ~₹66 at the
  // old rate vs. an actual ₹102 charge — the 2x understatement on this model
  // alone accounts for most of that gap.
  "gemini-3.1-flash-image": { inputPerMTok: 0.3, outputPerMTok: 60.0 },
  // gemini-3-pro-image (Nano Banana Pro) — Google's own docs state this
  // model's real billing is closer to a FLAT per-image price by resolution
  // tier (~$0.13 at 1K–2K, ~$0.24 at 4K) rather than a pure token rate — a
  // different billing shape than the token-metered family above. Rather than
  // restructure the cost-driver plumbing to a true perImageUsd (like the
  // Vertex VTO entry below) right now, this is an EQUIVALENT token rate
  // derived from our own observed output-token count for 2K images (~1305
  // tokens/image): $0.13 / (1305/1e6) ≈ $99.6/M, rounded. Approximation, not
  // a directly-quoted rate — will drift if actual output-token counts per
  // image change; migrate to perImageUsd if/when that's worth the plumbing.
  "gemini-3-pro-image": { inputPerMTok: 0.5, outputPerMTok: 100.0 },
  // Still unverified placeholders — no live usage data to reconcile against
  // yet. Correct before relying on these two for real billing decisions.
  "gemini-2.5-flash-image": { inputPerMTok: 0.3, outputPerMTok: 30.0 },
  "gemini-3.1-flash-lite-image": { inputPerMTok: 0.15, outputPerMTok: 15.0 },

  // Vertex Virtual Try-On (per generated image, no tokens reported)
  "virtual-try-on-001": { perImageUsd: 0.04 },

  // Veo video generation (Catalogue Motion) — billed per second of OUTPUT
  // video, audio-off tier. These rates are NOT from Google's own pricing
  // page (WebFetch on docs.cloud.google.com only returned nav shells, not
  // rendered content — see the catalogue-motion Phase 2 research); they are
  // triangulated from third-party pricing writeups found via search
  // (2026-08-22) and are meaningfully less certain than the entries above.
  // Reconcile against the actual GCP bill after the first real Veo run,
  // same as gemini-3.1-flash-image was reconciled above.
  "veo-3.1-lite-generate-001": { perSecondUsd: 0.05 },
  "veo-3.1-fast-generate-001": { perSecondUsd: 0.10 },
  "veo-3.0-generate-001": { perSecondUsd: 0.50 },
};

export interface CostDrivers {
  inputTokens?: number | null;
  outputTokens?: number | null;
  imagesGenerated?: number | null;
  /** Seconds of generated video output (Veo). */
  videoSeconds?: number | null;
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
  if (price.perSecondUsd && drivers.videoSeconds) {
    cost += drivers.videoSeconds * price.perSecondUsd;
  }
  return cost;
}

/** Whether we have a price entry for a model (useful for admin diagnostics). */
export function hasPrice(model: string): boolean {
  return model in PRICES;
}

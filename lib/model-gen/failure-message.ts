/**
 * Retailer-facing generation failure messages.
 *
 * Turns a raw provider/internal error string into a specific, actionable
 * message so the UI can tell the retailer WHAT went wrong and WHAT to do —
 * instead of spinning indefinitely or showing a generic failure. Single source
 * of truth, shared by the polling endpoint and the synchronous generate route.
 */

export type GenerationFailureReason =
  | "provider_capacity"
  | "network"
  | "storage"
  | "server"
  | "unknown";

export interface GenerationFailure {
  reason: GenerationFailureReason;
  message: string;
}

const MESSAGES: Record<GenerationFailureReason, string> = {
  // This function only ever classifies an error string logged from the AI
  // PROVIDER call itself (Gemini/Vertex) — a genuine retailer wallet
  // shortfall is caught earlier, before any provider call, by chargeForCall's
  // own insufficientCredits check, and never reaches here. So a "quota" or
  // "credit"-shaped message here is ALWAYS our own provider-side quota/rate
  // limit, never the retailer's balance — say so explicitly, since the old
  // wording ("not enough credits") wrongly told retailers to add money for a
  // failure that isn't theirs and (as of the fix alongside this file) isn't
  // charged to them either.
  provider_capacity:
    "Our AI provider hit a temporary capacity limit — this is on our end, not your credit balance, and you have not been charged for this attempt. Please try again shortly.",
  network:
    "A network problem interrupted image generation. Please check your connection and try again in a few minutes.",
  storage:
    "Image storage was temporarily unreachable, so the generated image could not be saved. Please try again shortly — no images were lost.",
  server:
    "The image service is temporarily unavailable. Please try again in a little while.",
  unknown:
    "Image generation failed for an unexpected reason. Please try again — if it keeps happening, please inform the team so we can look into it.",
};

/**
 * Categorize a raw error string into a reason + retailer-facing message.
 * Order matters: more specific patterns first.
 */
export function categorizeGenerationError(raw: string | null | undefined): GenerationFailure {
  const s = (raw ?? "").toLowerCase();

  // Provider quota/rate-limit (Gemini: RESOURCE_EXHAUSTED / 429) — OUR
  // account hitting its own API quota, never the retailer's wallet balance.
  if (/quota|resource_exhausted|exhausted|billing|credit|insufficient|permission_denied|429/.test(s)) {
    return { reason: "provider_capacity", message: MESSAGES.provider_capacity };
  }
  // Storage (Cloudinary) upload failures — recorded as "cloudinary_upload: …".
  if (/cloudinary|storage|upload/.test(s)) {
    return { reason: "storage", message: MESSAGES.storage };
  }
  // Network / DNS / timeout.
  if (/enotfound|eai_again|etimedout|econnreset|econnrefused|network|timeout|timed out|499|dns/.test(s)) {
    return { reason: "network", message: MESSAGES.network };
  }
  // Upstream server errors.
  if (/http 5\d\d|\b5\d\d\b|unavailable|internal error|service error|bad gateway|overloaded/.test(s)) {
    return { reason: "server", message: MESSAGES.server };
  }
  return { reason: "unknown", message: MESSAGES.unknown };
}

/** The generic message for a failure with no captured error string. */
export function genericFailureMessage(): string {
  return MESSAGES.unknown;
}

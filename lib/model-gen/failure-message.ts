/**
 * Retailer-facing generation failure messages.
 *
 * Turns a raw provider/internal error string into a specific, actionable
 * message so the UI can tell the retailer WHAT went wrong and WHAT to do —
 * instead of spinning indefinitely or showing a generic failure. Single source
 * of truth, shared by the polling endpoint and the synchronous generate route.
 */

export type GenerationFailureReason =
  | "credits"
  | "network"
  | "storage"
  | "server"
  | "unknown";

export interface GenerationFailure {
  reason: GenerationFailureReason;
  message: string;
}

const MESSAGES: Record<GenerationFailureReason, string> = {
  credits:
    "Image generation stopped because the AI image credits/quota appear to be exhausted. Please top up or check billing, then try again.",
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

  // Out of credits / quota / billing (Gemini: RESOURCE_EXHAUSTED / 429).
  if (/quota|resource_exhausted|exhausted|billing|credit|insufficient|permission_denied|429/.test(s)) {
    return { reason: "credits", message: MESSAGES.credits };
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

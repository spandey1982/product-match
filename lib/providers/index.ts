import type { TryOnProvider, TryOnProviderId } from "./types";
import { geminiTryOnProvider } from "./gemini-provider";
import { vertexTryOnProvider } from "./vertex-provider";

export type { TryOnProvider, TryOnProviderId } from "./types";

/** Registry of all known try-on providers, keyed by id. */
const PROVIDERS: Record<TryOnProviderId, TryOnProvider> = {
  gemini: geminiTryOnProvider,
  vertex: vertexTryOnProvider,
};

/**
 * The default try-on provider id — Gemini, always.
 *
 * This is the single source of truth for the default. Provider *selection*
 * (admin → automatic → customer) is intentionally NOT implemented here; that
 * is Tasks 3–5, which will build on this factory.
 */
export const DEFAULT_TRYON_PROVIDER_ID: TryOnProviderId = "gemini";

/**
 * Resolve a try-on provider by id. With no id, returns the default (Gemini).
 * Always returns a valid provider — never throws — so callers stay simple.
 */
export function getTryOnProvider(
  id: TryOnProviderId = DEFAULT_TRYON_PROVIDER_ID
): TryOnProvider {
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_TRYON_PROVIDER_ID];
}

/** List all registered providers (for future admin/customer surfaces). */
export function listTryOnProviders(): TryOnProvider[] {
  return Object.values(PROVIDERS);
}

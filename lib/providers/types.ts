import type { TryOnInput, TryOnResult } from "@/lib/tryon";

/** Identifier for a virtual try-on provider. */
export type TryOnProviderId = "gemini" | "vertex";

/**
 * A virtual try-on provider.
 *
 * Each implementation is a thin adapter over an existing generation function
 * (lib/tryon.ts, lib/tryon-vertex.ts) — providers do NOT reimplement generation
 * logic. New providers can be added without touching call sites; routes resolve
 * providers through the factory in ./index.
 *
 * Scope note: this abstraction covers try-on only. Model-image generation is
 * Gemini-only and intentionally NOT modelled here — it has a different axis
 * (Gemini model + prompt + knowledge base) and gets its own engine later.
 */
export interface TryOnProvider {
  /** Stable identifier used by the factory and future selection logic. */
  readonly id: TryOnProviderId;
  /** Human-readable label (for future admin/customer surfaces in Tasks 3–5). */
  readonly label: string;
  /**
   * Whether this provider is usable in the current environment (flags +
   * credentials present). Never throws.
   */
  isEnabled(): boolean;
  /**
   * Generate a virtual try-on image. Throws on failure — callers map errors
   * to HTTP responses (behavior identical to the wrapped functions).
   */
  generateTryOn(input: TryOnInput): Promise<TryOnResult>;
}

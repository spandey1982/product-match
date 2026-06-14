import { generateTryOn } from "@/lib/tryon";
import type { TryOnInput, TryOnResult } from "@/lib/tryon";
import type { TryOnProvider } from "./types";

/**
 * Gemini try-on provider — a thin adapter over the existing generateTryOn()
 * implementation in lib/tryon.ts. Behavior is unchanged; this only adds the
 * provider envelope so the factory can resolve it.
 */
export const geminiTryOnProvider: TryOnProvider = {
  id: "gemini",
  label: "Gemini",

  isEnabled(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return Boolean(key) && key !== "your-gemini-api-key-here";
  },

  generateTryOn(input: TryOnInput): Promise<TryOnResult> {
    return generateTryOn(input);
  },
};

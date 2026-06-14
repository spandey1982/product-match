import {
  generateTryOnVertex,
  isVertexTryOnEnabled,
  getVertexConfig,
} from "@/lib/tryon-vertex";
import type { TryOnInput, TryOnResult } from "@/lib/tryon";
import type { TryOnProvider } from "./types";

/**
 * Vertex AI try-on provider — a thin adapter over generateTryOnVertex() in
 * lib/tryon-vertex.ts. Feature-flagged: disabled unless ENABLE_VERTEX_TRYON is
 * "true" and Google Cloud configuration is present.
 */
export const vertexTryOnProvider: TryOnProvider = {
  id: "vertex",
  label: "Vertex AI",

  isEnabled(): boolean {
    return isVertexTryOnEnabled() && getVertexConfig() !== null;
  },

  generateTryOn(input: TryOnInput): Promise<TryOnResult> {
    return generateTryOnVertex(input);
  },
};

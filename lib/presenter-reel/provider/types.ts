/**
 * Presenter provider abstraction — mirrors lib/catalogue-motion/provider/
 * types.ts's MotionProvider shape exactly, for the same reason: new
 * providers (HeyGen, the documented fallback) plug in without touching call
 * sites once one exists.
 *
 * This is a deliberately SEPARATE interface from MotionProvider, not a
 * reuse of it, even though the winning implementation (Veo) is the same
 * underlying API — a presenter render takes a script (spoken dialogue) and
 * always produces audio; a motion render never does. Conflating the two
 * would leak a presenter-only concept (script) into the catalogue-motion
 * engine's input shape for no benefit, and the two modules are meant to stay
 * genuinely independent per the "leave the existing architecture untouched"
 * instruction that started this module.
 */
import type { AiUsageContext } from "@/lib/ai-usage/record";

export type PresenterProviderId = "veo" | "heygen";

export interface PresenterRenderInput {
  /** An existing generated on-model photo — never a new generation, never the raw upload (see lib/catalogue-motion/reel/reference-resolver.ts's same rule, and Component 9 of research/reel-engine-components.html for why). */
  sourceImageUrl: string;
  /** The exact line(s) the presenter speaks. Lip-sync and voice are generated from this text, not a separate TTS step — see veo-presenter-provider.ts's file header. */
  script: string;
  /** 4, 6, or 8 for the Veo backend — see nearestPresenterDuration(). */
  durationSec: number;
  productId?: string;
  usage?: AiUsageContext;
}

export interface PresenterRenderResult {
  /** Raw video bytes, base64 — the caller uploads to Cloudinary, mirroring ClipRenderResult's convention. */
  videoBase64: string;
  mimeType: string;
  durationMs: number;
  width: number;
  height: number;
  costUsd: number | null;
  provider: PresenterProviderId;
  model: string;
}

export interface PresenterProvider {
  readonly id: PresenterProviderId;
  readonly label: string;
  readonly maxDurationSec: number;
  /** Whether this provider is usable in the current environment (flags + credentials). Never throws. */
  isEnabled(): boolean;
  /** Best-effort cost estimate in USD for a clip of the given duration. Null when unknown. */
  estimateCost(durationSec: number): number | null;
  /** Render one clip. Throws on failure — the (future) orchestrator maps errors to job status. */
  generateClip(input: PresenterRenderInput): Promise<PresenterRenderResult>;
}

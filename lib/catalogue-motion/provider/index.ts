/**
 * Motion provider registry — mirrors lib/providers/index.ts (try-on factory).
 *
 * Only Veo is implemented for the Phase 2 POC. Kling is a known future
 * provider id (see the architecture spec's tier recommendations) but has no
 * adapter yet — requesting it falls back to the default rather than the
 * registry needing every union member populated.
 */
import type { MotionProvider, MotionProviderId } from "./types";
import { veoMotionProvider } from "./veo-provider";

export type { MotionProvider, MotionProviderId, ClipRenderInput, ClipRenderResult } from "./types";

const PROVIDERS: Partial<Record<MotionProviderId, MotionProvider>> = {
  veo: veoMotionProvider,
};

export const DEFAULT_MOTION_PROVIDER_ID: MotionProviderId = "veo";

/**
 * Resolve a motion provider by id. With no id, or an id that has no
 * registered adapter yet, returns the default (Veo). Always returns a valid
 * provider — never throws.
 */
export function getMotionProvider(id: MotionProviderId = DEFAULT_MOTION_PROVIDER_ID): MotionProvider {
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_MOTION_PROVIDER_ID]!;
}

export function listMotionProviders(): MotionProvider[] {
  return Object.values(PROVIDERS).filter((p): p is MotionProvider => p !== undefined);
}

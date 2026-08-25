/**
 * Every module key a ClientProfile.enabledModules array can reference. When
 * an account has no ClientProfile row, all of these are enabled — matching
 * the app's default, unrestricted experience.
 *
 * Client-safe: no db/auth imports here, since this is imported by client
 * components (e.g. ClientModulesProvider, CastingChooser) too. Server-side
 * gating helpers (getEnabledModules, requireModule, requireAuthWithModule)
 * live in lib/client-modules-server.ts.
 */
export const ALL_MODULES = [
  "catalog",
  "upload",
  "trial-room",
  "design-studio",
  "auto-catalog",
  "model-studio",
  "wishlist",
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

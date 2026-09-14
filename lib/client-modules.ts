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

/** Where each module lives — used to route a restricted client straight to
 * whatever they can actually see, instead of the hardcoded "/catalog" every
 * post-login redirect used before client-scoped restriction existed. */
export const MODULE_ROUTES: Record<ModuleKey, string> = {
  catalog: "/catalog",
  upload: "/upload",
  "trial-room": "/trial-room",
  "design-studio": "/fashion-designer",
  "auto-catalog": "/auto-catalog",
  "model-studio": "/assets/model-studio",
  wishlist: "/wishlist",
};

/** Preference order when more than one module is enabled — catalog first
 * (today's default landing page), so an unrestricted account's behavior
 * never changes. */
const LANDING_PRIORITY: ModuleKey[] = [
  "catalog",
  "trial-room",
  "upload",
  "design-studio",
  "model-studio",
  "auto-catalog",
  "wishlist",
];

/** First enabled module's route, in LANDING_PRIORITY order — falls back to
 * "/catalog" only when nothing at all is enabled (shouldn't happen in
 * practice, but keeps this total). */
export function resolveLandingPath(enabledModules: ModuleKey[]): string {
  const first = LANDING_PRIORITY.find((m) => enabledModules.includes(m));
  return first ? MODULE_ROUTES[first] : "/catalog";
}

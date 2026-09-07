// Centralized path constants for the Home Material Intelligence domain.
// Kept in one file specifically so the top-level segment (currently
// "/materials" — see docs/home-material/README.md's locked decisions) can
// be renamed later with a single-file + folder-rename change, rather than
// a repo-wide find/replace across every Link/redirect.

export const HM_ROOT = "/materials";

export const hmRoutes = {
  root: HM_ROOT,
} as const;

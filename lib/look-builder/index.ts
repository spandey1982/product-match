/**
 * Look Builder — public surface.
 *
 * System-controlled slot templates + matching-engine ranking, producing a
 * complete-look candidate set around an anchor product. See templates.ts (what
 * categories fill each slot) and builder.ts (how candidates are ranked).
 */
export {
  getLookTemplate,
  hasLookTemplate,
  listLookAnchors,
  normalizeCategory,
} from "./templates";
export { buildLook, type BuildLookOptions } from "./builder";
export type {
  LookSlot,
  LookTemplate,
  SlotCandidate,
  ResolvedSlot,
  ResolvedLook,
} from "./types";

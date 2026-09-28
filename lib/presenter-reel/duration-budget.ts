/**
 * Word/character budgets per Veo duration and delivery mode — shared
 * between script-generator.ts (server-side generation) and the Studio UI
 * (client-side character-limit display), so both sides agree on the same
 * numbers. Deliberately has NO imports from provider/veo-presenter-provider.ts
 * or anything else server-only (GoogleAuth, db, fs) — this file is imported
 * directly by a "use client" component, and pulling a server-only module in
 * transitively breaks the client bundle (see the client-scoped-module-
 * branding gotcha in project memory). ALLOWED_DURATIONS is therefore
 * duplicated here, not imported, matching this codebase's established
 * "duplicate small stable constants rather than cross-import" convention.
 *
 * Derived from the ~2.5-3 words/sec natural spoken pacing already
 * established for the original single 8s budget (script-generator.ts's
 * MAX_WORDS=22), scaled linearly to 4s/6s. See research/
 * presenter-reel-content-strategy.html's "Duration, transparency, and the
 * hook + end-card mode" section for the full rationale.
 */

export const ALLOWED_DURATIONS = [4, 6, 8] as const;
export type PresenterDurationSec = (typeof ALLOWED_DURATIONS)[number];
export type DeliveryMode = "full_script" | "hook_end_card";
export type CtaMode = "none" | "on_screen" | "spoken";
/**
 * How the end-card freeze-frame moment is chosen (hook_end_card mode only)
 * — see freeze-frame.ts. "smart" (default) analyzes the rendered clip's
 * own audio to find where speech actually ends; "fixed" skips that
 * analysis entirely and just uses a tighter word budget plus a fixed
 * offset from the clip's nominal end — cheaper, blunter.
 */
export type TimingMode = "smart" | "fixed";

const WORDS_PER_SEC = 2.75;
/** Rough chars-per-word for English at this conversational register — used only to turn a word budget into an editable-textarea character limit for the UI, not for generation itself. */
const CHARS_PER_WORD = 6;
/** Extra words a spoken CTA adds on top of the base budget — shown to the editor before they opt into ctaMode "spoken". */
export const SPOKEN_CTA_WORD_COST = 4;

/** Max spoken words for a full-script clip of this duration, leaving roughly 1s of natural pause/breath. */
export function fullScriptWordBudget(durationSec: number): number {
  return Math.max(6, Math.round((durationSec - 1) * WORDS_PER_SEC));
}

/**
 * Max spoken words for a hook-only line — deliberately duration-independent
 * (the hook doesn't need to grow with duration; the end card carries
 * everything else), capped by the shortest duration's own ceiling.
 * "fixed" timing mode caps it tighter still (8 vs 12) since that mode has
 * no audio analysis to fall back on — a shorter line leaves more margin
 * for the fixed end-of-clip offset to reliably land after she's finished
 * speaking.
 */
export function hookWordBudget(durationSec: number, timingMode: TimingMode = "smart"): number {
  const ceiling = timingMode === "fixed" ? 8 : 12;
  return Math.min(ceiling, fullScriptWordBudget(durationSec));
}

export function wordBudgetFor(durationSec: number, deliveryMode: DeliveryMode, ctaMode: CtaMode, timingMode: TimingMode = "smart"): number {
  const base = deliveryMode === "hook_end_card" ? hookWordBudget(durationSec, timingMode) : fullScriptWordBudget(durationSec);
  return ctaMode === "spoken" ? base + SPOKEN_CTA_WORD_COST : base;
}

/** Character limit for the Studio UI's editable script textarea — going over it warns the editor their edit may push the render into a costlier duration tier, per the "keep it editable but with limited character" decision. */
export function charLimitFor(durationSec: number, deliveryMode: DeliveryMode, ctaMode: CtaMode, timingMode: TimingMode = "smart"): number {
  return wordBudgetFor(durationSec, deliveryMode, ctaMode, timingMode) * CHARS_PER_WORD;
}

/**
 * Creative playbook — hand-authored marketing-craft guidance fed to the
 * director agent (agents/directorAgent.ts) as authoritative ground truth.
 *
 * Distilled from research/beyond-the-clip.html (114 sources on short-form
 * product/fashion video craft) — hook mechanics, professional cutting
 * rhythm, why craftsmanship detail earns more screen time than plain
 * fabric. Plays the same role in the director's prompt that
 * GarmentTemplate.blueprint plays in the fashion-designer planner's prompt:
 * a curated, versioned, hand-authored block the model must not contradict,
 * not a live trend-search call. Revise this file as research is refreshed;
 * the director agent itself never needs to change when it is.
 */

export const CREATIVE_PLAYBOOK = `
HOOK (authoritative): the opening shot must earn attention through motion or a reveal — a static establishing shot with nothing happening in the first beat does no work and should never lead. If the storyboard's available shots include one where real garment or camera motion is the actual subject (not just camera movement over a still garment), prefer it as the hook. A plain full-body establish, if used at all, belongs later in the sequence, not first.

PACING (authoritative): professional commercial editing holds a shot only as long as it takes to deliver ONE piece of new information, then cuts — average shot length in real commercials is under 2 seconds, not a uniform duration. Two rules follow directly:
- A shot showing genuine craftsmanship detail — embroidery, zari or metallic thread work, heavy embellishment, intricate texture, hand-finishing — has earned more screen time. Give it a longer hold (toward the 8-second ceiling below) and prefer a slower, closer camera move (a macro push or a detail reveal) so the detail actually registers.
- A shot showing plain fabric, a simple structural view, or anything with no distinguishing detail should be held briefly (as short as 1.5-2 seconds) and cut quickly — lingering on it wastes the viewer's attention on nothing new.
Do not give every shot the same duration by default. If two shots in a sequence would otherwise get the same hold, that is a signal to look again at what each one is actually showing.

HARD CEILING (authoritative, non-negotiable): a shot's holdDurationSec may never exceed 8 seconds. The underlying video generator has a fixed set of allowed clip lengths and the final edit can only trim a generated clip shorter, never lengthen it — so 8 seconds is a real technical ceiling, not a stylistic preference. Never propose a longer hold no matter how much detail a shot has to show.

THE CLOSE (authoritative): the sequence should end on a deliberate final beat, not just wherever the shots happen to run out. Prefer ending on a shot that reads as a natural close (a pulled-back full view, or the shot that best represents the whole garment) rather than a tight detail crop.

COHERENCE (authoritative): this system's default creative mode is a pure product showcase — real motion, real detail, no narrative or thematic overlay. Every shot should serve that single mode. Do not invent a story, a mood, or a theme not supported by the available shots.

FAILURE MODE TO AVOID: never compensate for a weak or awkward shot by simply cutting it faster — a shot that doesn't work should be dropped from the plan entirely (omit it from the shots list), not shortened as a way to hide it. Editing around a problem makes the whole sequence worse, not better; a shot that survives to the render stage should be one worth the time it's given.
`.trim();

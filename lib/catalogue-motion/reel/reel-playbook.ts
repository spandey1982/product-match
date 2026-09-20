/**
 * Ad/Marketing Reel creative playbook — the authoritative structural rules
 * every reel archetype inherits, regardless of preset (see
 * ReelArchetype in reel-types.ts — v1 ships one preset, "showcase-engaging",
 * but this file's rules are meant to outlive it: a future preset changes
 * tone/mood/branding, never this structure).
 *
 * Distilled from this session's reel-reference-study (four real reference
 * clips analyzed frame-by-frame) plus peer-reviewed backing: biological
 * motion (Johansson 1973), parasocial direct-address (Horton & Wohl 1956;
 * Atad & Cohen 2024), the vicarious haptic effect of watching a hand touch a
 * product (Peck & Shu 2009; Luangrath et al. 2022), and Mori's 1970 uncanny-
 * valley theory — motion deepens the valley, so engagement must come from
 * real, legible, bounded actions, never from pushing motion magnitude past
 * what the intensity system already allows.
 */

export const REEL_PLAYBOOK = `
STRUCTURE (authoritative, non-negotiable): every reel follows hook → interaction → detail → close, in that exact order. This is not a suggestion the shot list happens to follow — it is the sequence itself.

HOOK (authoritative): the opening shot is a static camera with the model directly engaging the lens — eye contact, a natural small gesture, as if talking to a real person. This is deliberately NOT a moving-camera establish: research on parasocial direct-address shows sustained lens engagement is what creates real viewer connection, and a static camera is what lets that engagement read clearly rather than competing with camera movement for attention.

INTERACTION (authoritative): the second shot must show a hand actually touching, lifting, or adjusting the product — not resting near it, not gesturing elsewhere. Watching a hand touch a product measurably increases how much a viewer wants it (the "vicarious haptic effect"); a shot where the product is merely visible while worn does not earn this beat.

DETAIL (authoritative): the third shot is the craftsmanship/fabric-truth close-up. It always animates the real, original product photo — never a generated model or mannequin image — because generated images are not a reliable source of the product's actual surface detail.

CLOSE (authoritative): the fourth and final shot is a turn or reveal that reads as a natural ending, leading into the branded end-card. Never end on a tight detail crop.

MOTION DISCIPLINE (authoritative, non-negotiable): every shot's motion — camera and gesture alike — stays within the job's selected intensity tier (see constraints.ts). Do not compensate for a shot feeling flat by proposing more or faster motion than the intensity tier allows. Per Mori's uncanny-valley research, motion that moves imperfectly reads as WORSE than a still image with the same imperfection — bounded, deliberate motion is the entire point, not a limitation to work around.

COHERENCE (authoritative): this archetype is a sharpened, engaging product showcase — real engagement and real product interaction, no invented narrative, mood, or seasonal theme. Do not invent a story the shots don't support.

FAILURE MODE TO AVOID: never compensate for a weak or awkward shot with faster cuts or more shots — a shot that doesn't work should be dropped, not hidden by editing around it.
`.trim();

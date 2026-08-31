/**
 * Creative Director agent — decides per-product shot selection, order, and
 * on-screen pacing for one Catalogue Motion job.
 *
 * Runs once per job, before any Veo rendering, and its output is immutable
 * through the render/QA cycle (see lib/catalogue-motion/orchestrator.ts —
 * a QA-rejected clip is regenerated at the same plan, never re-planned;
 * creative direction is source-driven, generation retry is attempt-driven,
 * and conflating them means an unlucky render attempt could churn the whole
 * plan for no reason).
 *
 * Modeled directly on lib/fashion-designer/agents/plannerAgent.ts: same
 * model tier (gemini-2.5-flash-lite — this is a planning/ordering task from
 * text descriptions, not the fine visual-quality judgment ai-review.ts was
 * found unreliable at), same temperature, same "prompt-instructed JSON, no
 * schema library, throw on malformed output" convention. The one place this
 * agent must NOT simply trust the LLM's output as-is is holdDurationSec —
 * see sanitizePlan below.
 */
import { storyboardFor } from "../storyboards";
import { resolvePreset } from "../grammar";
import { CREATIVE_PLAYBOOK } from "../playbook";
import { callGeminiForJson } from "../gemini-client";
import type { DirectorPlan, DirectorShotPlan, Storyboard } from "../types";
import type { AiUsageContext } from "@/lib/ai-usage/record";

/** Veo's real ceiling — a generated clip can only be trimmed shorter, never lengthened. */
const MAX_HOLD_SEC = 8;
const MIN_HOLD_SEC = 0.5;

export interface DirectorAgentInput {
  category: string;
  color: string;
  /** The already-rendered human-readable Garment Intelligence summary, when available — same field other prompts in this app already consume. */
  detailNotes?: string | null;
  usage?: AiUsageContext;
}

function buildShotMenu(storyboard: Storyboard): string {
  return storyboard.shots
    .map((s) => `- view="${s.view}" label="${s.label}" defaultPreset="${s.presetId}" — ${s.rationale}`)
    .join("\n");
}

function buildPrompt(input: DirectorAgentInput, storyboard: Storyboard): string {
  const detailLine = input.detailNotes?.trim()
    ? `- Craftsmanship/detail notes: ${input.detailNotes.trim()}`
    : "- No detailed craftsmanship notes available for this product — treat it as plain/simple unless the shot labels themselves suggest otherwise.";

  return `
You are the creative director for a short AI-generated product-showcase video for an Indian ethnic-fashion e-commerce catalogue. Decide, for THIS specific product, which of the available shots to use, in what order, and how long each stays on screen.

${CREATIVE_PLAYBOOK}

PRODUCT:
- Category: ${input.category}
- Color: ${input.color}
${detailLine}

AVAILABLE SHOTS (authoritative — choose only from this list; you may omit a shot, but never invent a view or preset that isn't listed here, and never use the same view twice):
${buildShotMenu(storyboard)}

Return ONLY valid JSON — no markdown, no explanation:
{
  "shots": [
    { "view": "...", "presetId": "...", "motionEmphasis": "...", "holdDurationSec": 0, "isHook": false, "rationale": "..." }
  ]
}
Rules: each view from the list above may appear AT MOST ONCE in your plan — never repeat a view to get a second treatment of it, omit shots you don't need instead. "motionEmphasis" is optional — include it only if this shot needs different garment-motion guidance than its default rationale implies; it must be a plain description of what happens on screen, never the name of a camera preset. "holdDurationSec" must be between ${MIN_HOLD_SEC} and ${MAX_HOLD_SEC}. Exactly one shot must have "isHook": true, and it must be listed first. The sum of every shot's holdDurationSec should land close to 15-20 seconds total — this is a short video, not a long one, so spend the extra time you give a detail shot by holding other shots shorter, not by adding length on top of the whole sequence.
`.trim();
}

/**
 * Never trust the director's raw JSON as final. Drops any shot referencing a
 * view/preset not actually in the storyboard's menu (a hallucination guard),
 * clamps holdDurationSec into [MIN_HOLD_SEC, MAX_HOLD_SEC] regardless of what
 * the model returned, and guarantees exactly one leading hook shot. Throws
 * only if nothing valid survives — an empty plan must not silently reach the
 * orchestrator.
 */
function sanitizePlan(raw: DirectorPlan, storyboard: Storyboard): DirectorPlan {
  const byView = new Map(storyboard.shots.map((s) => [s.view, s]));
  const seenViews = new Set<string>();

  const cleaned: DirectorShotPlan[] = (Array.isArray(raw?.shots) ? raw.shots : [])
    .filter((s): s is DirectorShotPlan => typeof s?.view === "string" && byView.has(s.view))
    // Each view may appear at most once — a repeated view (seen twice in a
    // live test) means the model tried to get two treatments of the same
    // shot; keep only its first occurrence rather than trust the prompt
    // instruction alone to prevent it.
    .filter((s) => (seenViews.has(s.view) ? false : (seenViews.add(s.view), true)))
    .map((s) => {
      const fallback = byView.get(s.view)!;
      const preset = resolvePreset(s.presetId) ? s.presetId : fallback.presetId;
      const rawHold = typeof s.holdDurationSec === "number" && Number.isFinite(s.holdDurationSec)
        ? s.holdDurationSec
        : fallback.durationSec;
      return {
        view: s.view,
        presetId: preset,
        motionEmphasis: s.motionEmphasis || fallback.motionEmphasis,
        holdDurationSec: Math.min(MAX_HOLD_SEC, Math.max(MIN_HOLD_SEC, rawHold)),
        isHook: Boolean(s.isHook),
        rationale: s.rationale || fallback.rationale,
      };
    });

  if (cleaned.length === 0) {
    throw new Error("Director agent returned no valid shots after sanitization");
  }

  // Exactly one hook, and it leads.
  const hookIndex = cleaned.findIndex((s) => s.isHook);
  const ordered = hookIndex > 0 ? [cleaned[hookIndex], ...cleaned.filter((_, i) => i !== hookIndex)] : cleaned;
  ordered.forEach((s, i) => { s.isHook = i === 0; });

  return { shots: ordered };
}

export async function directorAgent(input: DirectorAgentInput): Promise<DirectorPlan> {
  const storyboard = storyboardFor(input.category);
  const prompt = buildPrompt(input, storyboard);

  const raw = await callGeminiForJson<DirectorPlan>(prompt, {
    temperature: 0.3,
    usage: input.usage ? { ...input.usage, operation: "direct_plan" } : undefined,
  });

  return sanitizePlan(raw, storyboard);
}

/**
 * Turns product metadata (+ Garment Intelligence, when available) into the
 * spoken line(s) for a presenter clip. Rewritten for the content-strategy
 * upgrade (research/presenter-reel-content-strategy.html) — duration- and
 * delivery-mode-aware, preferring GI-derived detail over the coarser
 * Product fields when available, and structured so a second script
 * template is a new prompt builder, not a rewrite (only "value_trust"
 * exists today, per the reviewer's ranked build order in that doc).
 *
 * In "hook_end_card" delivery mode this generates ONLY a short opener —
 * price/features/trust/CTA move to the deterministic end card (end-card.ts)
 * instead, never spoken, never LLM-authored.
 */
import { parseArray } from "@/lib/serialize";
import type { AiUsageContext } from "@/lib/ai-usage/record";
import { callGeminiForJson } from "./gemini-client";
import { wordBudgetFor, type DeliveryMode, type CtaMode, type TimingMode } from "./duration-budget";

export interface ScriptProductInput {
  title: string;
  category: string;
  color: string;
  material?: string | null;
  pattern?: string | null;
  detailNotes?: string | null;
  /** Serialized JSON array (Product.occasion) — read via lib/serialize.ts's parseArray, never parsed directly. */
  occasion?: string | null;
  price: number;
  /** Garment Intelligence's curated "what a buyer would notice first" list (craftsmanship.highlights) — cataloguing-time-extracted, preferred over the coarser fields above when present. Empty/undefined for products never analyzed. */
  giHighlights?: string[];
}

export interface GenerateScriptOptions {
  durationSec: number;
  deliveryMode: DeliveryMode;
  ctaMode: CtaMode;
  /** Required when ctaMode is "spoken" — the exact CTA the model must end on. */
  ctaText?: string | null;
  templateId?: "value_trust";
  /** Only meaningful for hook_end_card — "fixed" caps the hook word budget tighter (duration-budget.ts), leaving more margin for freeze-frame.ts's non-analyzed fixed offset. Defaults to "smart". */
  timingMode?: TimingMode;
}

interface GeneratedScriptResponse {
  script: string;
}

function pickDetail(product: ScriptProductInput): string {
  if (product.giHighlights && product.giHighlights.length > 0) return product.giHighlights[0];
  return product.detailNotes?.trim() || product.pattern?.trim() || product.material?.trim() || "not specified";
}

function buildPrompt(product: ScriptProductInput, options: GenerateScriptOptions): string {
  const occasions = parseArray(product.occasion ?? undefined).join(", ") || "everyday wear";
  const wordBudget = wordBudgetFor(options.durationSec, options.deliveryMode, options.ctaMode, options.timingMode);
  const spokenCtaLine =
    options.ctaMode === "spoken" && options.ctaText
      ? `\n- End with this exact call to action, spoken naturally: "${options.ctaText}"`
      : "";

  if (options.deliveryMode === "hook_end_card") {
    return `You are writing a single short spoken HOOK line for an AI presenter product video — just the opening line, not the full pitch. The rest of the product's details (price, features, call to action) will appear as on-screen text right after the model finishes speaking, NOT in this line.

Product: ${product.title}
Category: ${product.category}
Color: ${product.color}
Occasion: ${occasions}

Write ONE natural, warm, attention-grabbing spoken opener that introduces this product — a greeting-and-reveal, not a feature pitch (features come later, on-screen). Real examples of the right register:
- "Hey! You have to see this one."
- "Hi everyone — wait until you see this gorgeous piece."

Rules:
- ${wordBudget} words maximum.
- Plain spoken English. No hashtags, no emoji, at most one exclamation point.
- Do NOT mention price, discounts, or a call to action — those come later, on-screen.${spokenCtaLine}

Respond with ONLY this JSON, no markdown fence: {"script": "..."}`;
  }

  const detail = pickDetail(product);
  return `You are writing a single spoken line for a ${options.durationSec}-second talking-presenter product video. A model will say this line on camera while gesturing naturally — no other narration, no second sentence.

Product: ${product.title}
Category: ${product.category}
Color: ${product.color}
Material: ${product.material ?? "not specified"}
Pattern/detail: ${detail}
Occasion: ${occasions}
Price: Rs. ${product.price}

Write ONE natural, warm, enthusiastic spoken line that: opens with a greeting, calls out ONE genuine, specific detail from the fields above (never invent a detail that isn't given), and mentions the price naturally as part of the sentence. Match this register, these are real examples already validated on real generations:
- "Hey! Just look at this stunning burgundy suit — the tailored fit is amazing, perfect for weddings and parties, just Rs. 2999."
- "Hi everyone! This gorgeous peach saree has the most beautiful gold embroidery all over it, at just Rs. 1499 — isn't it stunning?"

Rules:
- ${wordBudget} words maximum — it must fit naturally into ${options.durationSec} seconds of speech.
- Plain spoken English. No hashtags, no emoji, at most one exclamation point.
- Open with "Hey!" or "Hi everyone!" or a close equivalent, matching the examples.
- Reference the specific detail given above, not a generic compliment like "so beautiful."${spokenCtaLine}

Respond with ONLY this JSON, no markdown fence: {"script": "..."}`;
}

/**
 * Throws on missing API key, HTTP failure, or unparsable Gemini response —
 * same contract as callGeminiForJson itself; callers decide whether to
 * catch and fall back to a manual script.
 */
export async function generatePresenterScript(
  product: ScriptProductInput,
  options: GenerateScriptOptions,
  usage: AiUsageContext
): Promise<string> {
  const prompt = buildPrompt(product, options);
  const result = await callGeminiForJson<GeneratedScriptResponse>(prompt, {
    temperature: 0.7,
    usage: { ...usage, operation: "generate_script" },
  });

  const script = result.script?.trim();
  if (!script) throw new Error("Gemini returned an empty script");

  const wordBudget = wordBudgetFor(options.durationSec, options.deliveryMode, options.ctaMode, options.timingMode);
  const wordCount = script.split(/\s+/).length;
  if (wordCount > wordBudget + 8) {
    // Soft check, not a hard failure — occasional overlong lines just mean
    // Veo paces the speech faster within the fixed duration, not a broken
    // generation. Logged so real drift is visible.
    console.warn(`[presenter-reel] script exceeded target length (${wordCount}/${wordBudget} words): "${script}"`);
  }

  return script;
}

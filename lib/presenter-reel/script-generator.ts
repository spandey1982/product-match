/**
 * M3 — turns product metadata into the spoken line a presenter clip's
 * script comes from. Before this existed, every job (M1/M2's verification
 * included) used a hand-written script string.
 *
 * The prompt is built from the same examples that already validated the
 * winning register during the M0/M1 spike (research/
 * ai-presenter-reel-reverse-engineering.html) — "Hey! Just look at
 * this..." — rather than inventing a new voice from scratch, so the script
 * this produces matches what's already been proven to generate well.
 */
import { parseArray } from "@/lib/serialize";
import type { AiUsageContext } from "@/lib/ai-usage/record";
import { callGeminiForJson } from "./gemini-client";

/** ~8s of natural spoken pacing (~2.5–3 words/sec) — Veo's hard per-call duration cap, same constraint the catalogue reel engine already works around. */
const MAX_WORDS = 22;

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
}

interface GeneratedScriptResponse {
  script: string;
}

function buildPrompt(product: ScriptProductInput): string {
  const occasions = parseArray(product.occasion ?? undefined).join(", ") || "everyday wear";
  const detail = product.detailNotes?.trim() || product.pattern?.trim() || product.material?.trim() || "not specified";

  return `You are writing a single spoken line for an 8-second talking-presenter product video. A model will say this line on camera while gesturing naturally — no other narration, no second sentence.

Product: ${product.title}
Category: ${product.category}
Color: ${product.color}
Material: ${product.material ?? "not specified"}
Pattern/detail: ${detail}
Occasion: ${occasions}
Price: ₹${product.price}

Write ONE natural, warm, enthusiastic spoken line that introduces this product and calls out ONE genuine, specific detail from the fields above — never invent a detail that isn't given. Match this exact register and length; these are real examples already validated on real generations:
- "Hey! Just look at this stunning burgundy suit — the tailored fit is amazing, perfect for weddings and parties."
- "Hi everyone! This gorgeous peach saree has the most beautiful gold embroidery all over it — just look at this pallu, isn't it stunning?"

Rules:
- ${MAX_WORDS} words maximum — it must fit naturally into 8 seconds of speech.
- Plain spoken English. No hashtags, no emoji, at most one exclamation point.
- Open with "Hey!" or "Hi everyone!" or a close equivalent, matching the examples.
- Reference the specific detail given above, not a generic compliment like "so beautiful."

Respond with ONLY this JSON, no markdown fence: {"script": "..."}`;
}

/**
 * Throws on missing API key, HTTP failure, or unparsable Gemini response —
 * same contract as callGeminiForJson itself; callers (the future
 * orchestrator) decide whether to catch and fall back to a manual script.
 */
export async function generatePresenterScript(product: ScriptProductInput, usage: AiUsageContext): Promise<string> {
  const prompt = buildPrompt(product);
  const result = await callGeminiForJson<GeneratedScriptResponse>(prompt, {
    temperature: 0.7,
    usage: { ...usage, operation: "generate_script" },
  });

  const script = result.script?.trim();
  if (!script) throw new Error("Gemini returned an empty script");

  const wordCount = script.split(/\s+/).length;
  if (wordCount > MAX_WORDS + 8) {
    // Soft check, not a hard failure — Gemini-2.5-flash-lite has been
    // reliable on this constraint in testing, but an occasional overlong
    // line just means Veo paces the speech faster within the fixed 8s
    // clip, not a broken generation. Logged so real drift is visible.
    console.warn(`[presenter-reel] script exceeded target length (${wordCount} words): "${script}"`);
  }

  return script;
}

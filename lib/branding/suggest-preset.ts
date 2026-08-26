import { callGeminiForJson, fetchImageAsPart, type ImagePart } from "@/lib/fashion-designer/gemini-client";
import { THEME_PRESETS, isThemePresetKey, type ThemePresetKey } from "@/lib/branding/presets";

/**
 * Fixed, human-written descriptions of what each curated preset LOOKS/FEELS
 * like — not the raw hex/shadow values, which mean nothing to a vision model
 * on their own. Keep in sync with lib/branding/presets.ts by hand; this is
 * intentionally not auto-derived so the wording stays curated.
 */
const PRESET_DESCRIPTIONS: Record<ThemePresetKey, string> = {
  default: "Modern, friendly, tech-forward SaaS look: indigo-to-purple gradient, soft rounded corners, gentle shadow.",
  royal: "Rich, high-end, ornate: deep maroon-to-gold gradient, tighter corners, pronounced shadow — suits bridal/designer/luxury-craft brands.",
  elegant: "Minimal, quiet-luxury, refined: flat charcoal, sharp corners, no shadow — suits boutique/premium retail brands that want restraint over ornamentation.",
};

export interface ThemeSuggestion {
  preset: ThemePresetKey;
  reasoning: string;
}

interface SuggestThemeUsage {
  userId?: string | null;
  storeId?: string | null;
}

/**
 * Suggests which of the 3 curated presets (never a new one — see
 * lib/branding/presets.ts) best fits a client's brand, from their logo +
 * a few product photos. A suggestion for a human to accept/override, never
 * applied automatically. Real paid Gemini call — callers must gate this
 * behind an explicit action, not run it automatically.
 */
export async function suggestThemePreset(
  imageUrls: string[],
  usage: SuggestThemeUsage
): Promise<ThemeSuggestion> {
  const fetched = await Promise.all(imageUrls.map((url) => fetchImageAsPart(url)));
  const images = fetched.filter((p): p is ImagePart => p !== null);
  if (images.length === 0) {
    throw new Error("No usable images to analyze");
  }

  const presetList = (Object.keys(THEME_PRESETS) as ThemePresetKey[])
    .map((key) => `- "${key}": ${PRESET_DESCRIPTIONS[key]}`)
    .join("\n");

  const prompt = `You are choosing a UI theme preset for a fashion retailer's white-labeled dashboard, from their logo and product photos.

Pick exactly ONE of these presets — never invent a new one:
${presetList}

Look at the attached logo and product images: their color palette, ornamentation level, and overall brand positioning (mass-market vs. premium vs. ultra-luxury).

Respond with ONLY a JSON object: {"preset": "default" | "royal" | "elegant", "reasoning": "one sentence explaining the fit"}`;

  const result = await callGeminiForJson<{ preset: string; reasoning: string }>(prompt, images, {
    usage: { feature: "theme_suggestion", operation: "suggest_preset", userId: usage.userId, storeId: usage.storeId },
  });

  return {
    preset: isThemePresetKey(result.preset) ? result.preset : "default",
    reasoning: result.reasoning || "No reasoning returned.",
  };
}

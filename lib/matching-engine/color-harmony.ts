export type ColorMatchResult = {
  score: number;
  label: string;
  type: "complementary" | "tonal" | "festive" | "neutral" | "clash";
};

// Normalized color families
const COLOR_FAMILIES: Record<string, string[]> = {
  red: ["red", "crimson", "scarlet", "ruby", "cherry", "rose"],
  maroon: ["maroon", "burgundy", "wine", "oxblood"],
  pink: ["pink", "blush", "baby pink", "hot pink", "magenta", "fuchsia", "dusty pink"],
  orange: ["orange", "burnt orange", "coral", "peach", "terracotta", "rust"],
  yellow: ["yellow", "mustard", "golden", "lemon", "saffron", "turmeric"],
  gold: ["gold", "golden", "antique gold"],
  green: ["green", "emerald", "mint", "sage", "olive", "forest green", "bottle green"],
  teal: ["teal", "turquoise", "aqua", "cyan"],
  blue: ["blue", "navy", "royal blue", "cobalt", "indigo", "powder blue"],
  purple: ["purple", "violet", "plum", "lavender", "lilac"],
  white: ["white", "ivory", "off-white", "cream"],
  black: ["black", "charcoal", "jet"],
  grey: ["grey", "gray", "silver", "ash"],
  silver: ["silver", "platinum"],
  brown: ["brown", "tan", "beige", "camel", "nude", "taupe", "khaki"],
  multicolor: ["multicolor", "multi", "printed", "tie-dye"],
};

// Harmony rules: [colorFamily] -> [targetColorFamily, score, label, type]
const HARMONY_RULES: Record<
  string,
  Array<[string, number, string, ColorMatchResult["type"]]>
> = {
  red: [
    ["gold", 0.95, "Regal festive combination", "festive"],
    ["black", 0.9, "Bold contrast pairing", "complementary"],
    ["white", 0.85, "Classic vivid pairing", "complementary"],
    ["silver", 0.8, "Festive metallic accent", "festive"],
    ["beige", 0.75, "Warm earth tones", "tonal"],
    ["cream", 0.7, "Soft warm contrast", "neutral"],
  ],
  maroon: [
    ["gold", 0.95, "Traditional festive pairing", "festive"],
    ["beige", 0.85, "Warm earthy harmony", "tonal"],
    ["ivory", 0.85, "Classic rich contrast", "complementary"],
    ["pink", 0.7, "Warm tonal blend", "tonal"],
    ["silver", 0.75, "Elegant metallic accent", "festive"],
  ],
  pink: [
    ["silver", 0.9, "Feminine metallic accent", "complementary"],
    ["gold", 0.85, "Soft festive pairing", "festive"],
    ["white", 0.8, "Fresh soft combination", "tonal"],
    ["grey", 0.75, "Modern muted pairing", "complementary"],
    ["green", 0.7, "Vibrant colour block", "complementary"],
    ["beige", 0.8, "Soft pastel harmony", "tonal"],
  ],
  orange: [
    ["gold", 0.9, "Warm festive pairing", "festive"],
    ["brown", 0.85, "Earthy warm tones", "tonal"],
    ["white", 0.8, "Fresh vibrant contrast", "complementary"],
    ["black", 0.75, "Bold pop contrast", "complementary"],
    ["teal", 0.7, "Vibrant complementary", "complementary"],
  ],
  yellow: [
    ["red", 0.8, "Vibrant festive pairing", "festive"],
    ["orange", 0.8, "Warm analogous blend", "tonal"],
    ["gold", 0.75, "Warm tonal harmony", "tonal"],
    ["brown", 0.7, "Earthy sunny pairing", "tonal"],
    ["black", 0.85, "Bold contrast statement", "complementary"],
    ["white", 0.8, "Fresh bright pairing", "complementary"],
  ],
  gold: [
    ["red", 0.95, "Regal festive combination", "festive"],
    ["maroon", 0.95, "Traditional bridal pairing", "festive"],
    ["green", 0.9, "Classic festive harmony", "festive"],
    ["navy", 0.85, "Regal contrast pairing", "complementary"],
    ["black", 0.9, "Luxe contrast pairing", "complementary"],
    ["pink", 0.85, "Soft festive elegance", "festive"],
    ["purple", 0.85, "Royal festive pairing", "festive"],
  ],
  green: [
    ["gold", 0.9, "Classic festive harmony", "festive"],
    ["red", 0.85, "Vibrant festive contrast", "complementary"],
    ["pink", 0.7, "Nature-inspired blend", "complementary"],
    ["beige", 0.8, "Natural earthy harmony", "tonal"],
    ["white", 0.75, "Fresh botanical pairing", "complementary"],
  ],
  teal: [
    ["gold", 0.85, "Jewel-toned festive accent", "festive"],
    ["orange", 0.7, "Vibrant complementary pairing", "complementary"],
    ["white", 0.8, "Fresh ocean-inspired look", "complementary"],
    ["pink", 0.7, "Tropical vibrant pairing", "complementary"],
    ["silver", 0.75, "Cool metallic accent", "complementary"],
  ],
  blue: [
    ["gold", 0.9, "Regal nautical statement", "complementary"],
    ["white", 0.85, "Classic naval pairing", "complementary"],
    ["silver", 0.8, "Cool metallic accent", "complementary"],
    ["tan", 0.8, "Smart casual pairing", "tonal"],
    ["orange", 0.7, "Bold complementary contrast", "complementary"],
    ["grey", 0.75, "Corporate cool tones", "tonal"],
  ],
  purple: [
    ["gold", 0.9, "Royal festive pairing", "festive"],
    ["silver", 0.85, "Regal metallic accent", "complementary"],
    ["white", 0.8, "Soft royal contrast", "complementary"],
    ["pink", 0.75, "Romantic warm blend", "tonal"],
    ["black", 0.8, "Bold luxe statement", "complementary"],
  ],
  white: [
    ["gold", 0.9, "Pristine festive accent", "festive"],
    ["silver", 0.85, "Classic bridal styling", "complementary"],
    ["any", 0.75, "Universal versatile base", "neutral"],
  ],
  black: [
    ["gold", 0.95, "Luxe metallic contrast", "complementary"],
    ["silver", 0.9, "Sleek metallic accent", "complementary"],
    ["red", 0.85, "Bold power statement", "complementary"],
    ["white", 0.8, "Timeless classic contrast", "complementary"],
    ["any", 0.65, "Versatile base tone", "neutral"],
  ],
  grey: [
    ["silver", 0.85, "Monochromatic cool tones", "tonal"],
    ["blue", 0.75, "Corporate cool pairing", "tonal"],
    ["pink", 0.75, "Modern soft contrast", "complementary"],
    ["white", 0.8, "Minimal clean pairing", "tonal"],
    ["black", 0.8, "Classic monochrome", "tonal"],
  ],
  silver: [
    ["black", 0.9, "Sleek metallic contrast", "complementary"],
    ["grey", 0.85, "Cool tonal harmony", "tonal"],
    ["blue", 0.8, "Cool metallic accent", "complementary"],
    ["purple", 0.85, "Regal metallic pairing", "festive"],
    ["pink", 0.85, "Feminine metallic accent", "festive"],
    ["white", 0.85, "Pristine metallic styling", "complementary"],
  ],
  brown: [
    ["beige", 0.9, "Warm tonal harmony", "tonal"],
    ["tan", 0.9, "Earthy coordinated look", "tonal"],
    ["gold", 0.8, "Warm festive accent", "festive"],
    ["orange", 0.75, "Warm analogous pairing", "tonal"],
    ["white", 0.7, "Natural warm contrast", "complementary"],
    ["green", 0.7, "Earthy nature tones", "tonal"],
  ],
};

function getColorFamily(color: string): string | null {
  const normalized = color.toLowerCase().trim();
  for (const [family, variants] of Object.entries(COLOR_FAMILIES)) {
    if (variants.some((v) => normalized.includes(v) || v.includes(normalized))) {
      return family;
    }
  }
  return null;
}

export function getColorCompatibility(
  sourceColor: string,
  targetColor: string
): ColorMatchResult {
  const srcFamily = getColorFamily(sourceColor);
  const tgtFamily = getColorFamily(targetColor);

  if (!srcFamily || !tgtFamily) {
    return { score: 0.5, label: "Versatile pairing", type: "neutral" };
  }

  if (srcFamily === tgtFamily) {
    return {
      score: 0.7,
      label: "Tonal monochromatic pairing",
      type: "tonal",
    };
  }

  // Look for specific harmony rules
  const rules = HARMONY_RULES[srcFamily] || [];
  for (const [target, score, label, type] of rules) {
    if (target === tgtFamily || target === "any") {
      return { score, label, type };
    }
  }

  // Reverse lookup
  const reverseRules = HARMONY_RULES[tgtFamily] || [];
  for (const [target, score, label, type] of reverseRules) {
    if (target === srcFamily || target === "any") {
      return { score, label, type };
    }
  }

  // Check for metallic neutrals
  if (srcFamily === "gold" || tgtFamily === "gold") {
    return {
      score: 0.75,
      label: "Warm metallic accent",
      type: "complementary",
    };
  }
  if (srcFamily === "silver" || tgtFamily === "silver") {
    return {
      score: 0.7,
      label: "Cool metallic accent",
      type: "complementary",
    };
  }

  return { score: 0.3, label: "Contrasting tones", type: "clash" };
}

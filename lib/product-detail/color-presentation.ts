/**
 * Presentation-only color helpers for the product detail page — swatches,
 * short descriptors, and "pairs well with" suggestions for display purposes.
 *
 * This is deliberately separate from lib/matching-engine/color-harmony.ts
 * (the protected scoring engine): nothing here feeds recommendation scoring,
 * it only decorates the UI. Keeping it separate avoids touching a
 * business-critical file for a cosmetic feature.
 */

type ColorBucket =
  | "warm-neutral"
  | "cool-neutral"
  | "jewel"
  | "pastel"
  | "vibrant"
  | "earthy"
  | "cool";

const SWATCH_MAP: Array<[string[], string]> = [
  [["champagne"], "#E8D9C0"],
  [["ivory"], "#F8F4EC"],
  [["cream"], "#F5EFE3"],
  [["off-white", "offwhite"], "#F6F5F1"],
  [["white"], "#FAFAFA"],
  [["beige", "nude", "sand"], "#E3CBA8"],
  [["tan", "camel", "khaki"], "#C8A165"],
  [["taupe"], "#B8A99A"],
  [["gold", "golden"], "#C9A24B"],
  [["mustard"], "#D2A438"],
  [["yellow", "lemon", "saffron", "turmeric"], "#E7C13A"],
  [["peach"], "#F0BFA0"],
  [["coral"], "#E8836B"],
  [["rust", "terracotta", "burnt orange"], "#B85C3E"],
  [["orange"], "#E28743"],
  [["blush", "dusty pink", "rose"], "#D9A0A6"],
  [["pink", "baby pink"], "#E8B4C0"],
  [["magenta", "fuchsia", "hot pink"], "#C33E85"],
  [["maroon", "burgundy", "wine", "oxblood"], "#6B1F2A"],
  [["red", "crimson", "scarlet", "ruby", "cherry"], "#B3312C"],
  [["mint"], "#B7D8C6"],
  [["sage"], "#9CAF88"],
  [["olive"], "#6E7639"],
  [["emerald", "bottle green", "forest green"], "#1F5C3D"],
  [["green"], "#4C7A4E"],
  [["teal", "turquoise", "aqua", "cyan"], "#2E8C88"],
  [["navy"], "#1F2A4A"],
  [["blue", "cobalt", "powder blue", "royal blue"], "#2F5FA8"],
  [["indigo"], "#3F3D7A"],
  [["lavender", "lilac"], "#C6B7DE"],
  [["purple", "violet", "plum"], "#6B4A8A"],
  [["silver", "platinum"], "#C7C9CC"],
  [["grey", "gray", "ash"], "#9CA0A6"],
  [["charcoal"], "#3F3F42"],
  [["black", "jet"], "#232326"],
  [["brown"], "#6B4A34"],
];

/** Best-effort hex for a free-text fashion color name, for a small swatch dot. */
export function colorSwatchHex(raw: string): string {
  const n = raw.toLowerCase();
  for (const [keys, hex] of SWATCH_MAP) {
    if (keys.some((k) => n.includes(k))) return hex;
  }
  return "#D4D4D8";
}

function colorBucket(raw: string): ColorBucket {
  const n = raw.toLowerCase();
  if (/champagne|ivory|cream|beige|tan|camel|khaki|taupe|gold|nude|sand/.test(n)) return "warm-neutral";
  if (/white|silver|platinum|grey|gray|ash|charcoal|black/.test(n)) return "cool-neutral";
  if (/maroon|burgundy|wine|oxblood|emerald|navy|indigo|purple|violet|plum|teal/.test(n)) return "jewel";
  if (/blush|pink|peach|lavender|lilac|mint|rose/.test(n)) return "pastel";
  if (/red|crimson|scarlet|ruby|cherry|orange|coral|rust|mustard|yellow|magenta|fuchsia/.test(n)) return "vibrant";
  if (/green|olive|sage|brown|terracotta/.test(n)) return "earthy";
  if (/blue|cobalt|turquoise|aqua|cyan/.test(n)) return "cool";
  return "warm-neutral";
}

const DESCRIPTORS: Record<ColorBucket, string> = {
  "warm-neutral": "Warm Neutral",
  "cool-neutral": "Cool Neutral",
  jewel: "Jewel Tone",
  pastel: "Soft Pastel",
  vibrant: "Vibrant Tone",
  earthy: "Earthy Tone",
  cool: "Cool Tone",
};

/** Short, tasteful family label shown under the color name (e.g. "Warm Neutral"). */
export function colorDescriptor(raw: string): string {
  return DESCRIPTORS[colorBucket(raw)];
}

const PAIRINGS: Record<ColorBucket, Array<{ name: string; hex: string }>> = {
  "warm-neutral": [
    { name: "Sage Green", hex: "#9CAF88" },
    { name: "Dusty Rose", hex: "#C48189" },
    { name: "Ivory", hex: "#F8F4EC" },
    { name: "Antique Gold", hex: "#C9A24B" },
  ],
  "cool-neutral": [
    { name: "Blush Pink", hex: "#E8B4C0" },
    { name: "Dusty Rose", hex: "#C48189" },
    { name: "Champagne", hex: "#E8D9C0" },
    { name: "Sage Green", hex: "#9CAF88" },
  ],
  jewel: [
    { name: "Ivory", hex: "#F8F4EC" },
    { name: "Champagne", hex: "#E8D9C0" },
    { name: "Blush Pink", hex: "#E8B4C0" },
    { name: "Silver", hex: "#C7C9CC" },
  ],
  pastel: [
    { name: "Sage Green", hex: "#9CAF88" },
    { name: "Ivory", hex: "#F8F4EC" },
    { name: "Champagne", hex: "#E8D9C0" },
    { name: "Dusty Rose", hex: "#C48189" },
  ],
  vibrant: [
    { name: "Ivory", hex: "#F8F4EC" },
    { name: "Antique Gold", hex: "#C9A24B" },
    { name: "Charcoal", hex: "#3F3F42" },
    { name: "Sage Green", hex: "#9CAF88" },
  ],
  earthy: [
    { name: "Ivory", hex: "#F8F4EC" },
    { name: "Terracotta", hex: "#B85C3E" },
    { name: "Antique Gold", hex: "#C9A24B" },
    { name: "Cream", hex: "#F5EFE3" },
  ],
  cool: [
    { name: "Ivory", hex: "#F8F4EC" },
    { name: "Silver", hex: "#C7C9CC" },
    { name: "Antique Gold", hex: "#C9A24B" },
    { name: "Blush Pink", hex: "#E8B4C0" },
  ],
};

/** Curated "pairs well with" swatches for a base color family — decorative styling guidance only. */
export function pairingSuggestions(raw: string): Array<{ name: string; hex: string }> {
  return PAIRINGS[colorBucket(raw)];
}

const NOTES: Record<ColorBucket, string> = {
  "warm-neutral":
    "These soft neutrals and muted accents complement the warmth of this shade for a balanced, elevated look.",
  "cool-neutral":
    "These gentle, warmer tones soften this neutral shade while keeping the palette calm and refined.",
  jewel:
    "These lighter neutrals let this rich tone stand out while keeping the pairing elegant and understated.",
  pastel:
    "These soft, muted tones echo the gentleness of this shade for a light, harmonious palette.",
  vibrant:
    "These grounded neutrals balance the energy of this shade for a polished, wearable combination.",
  earthy:
    "These warm neutrals and metallic accents bring out the richness of this earthy tone.",
  cool: "These warm accents offset the coolness of this shade for a well-rounded palette.",
};

/** One-line styling note shown beside the pairing swatches. */
export function pairingNote(raw: string): string {
  return NOTES[colorBucket(raw)];
}

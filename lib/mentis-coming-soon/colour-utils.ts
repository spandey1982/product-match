import { COLOUR_PARAMETERS, type ColourConfig } from "./theme";

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "f5e" / "#F5E8D3" -> "#FF55EE" / "#F5E8D3"; null when not a valid 3/6-digit hex. */
export function normaliseHex(input: string): string | null {
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  let h = m[1].toUpperCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

function luminance(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio (1–21) between two normalised hex colours. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function paletteAsText(colours: ColourConfig): string {
  return COLOUR_PARAMETERS.map((p) => `${p.number}. ${p.label}: ${colours[p.key]}`).join("\n");
}

export function paletteAsJson(colours: ColourConfig): string {
  const out: Record<string, string> = {};
  for (const p of COLOUR_PARAMETERS) out[p.key] = colours[p.key];
  return JSON.stringify(out, null, 2);
}

export function paletteAsCss(colours: ColourConfig): string {
  const lines = COLOUR_PARAMETERS.map((p) => `  ${p.cssVar}: ${colours[p.key]};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

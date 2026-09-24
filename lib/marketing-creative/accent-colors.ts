/**
 * Named-color → hex lookup, scoped to the exact vocabulary used across
 * lib/model-gen/scenes/library.ts's palette.accent/base arrays — not a
 * general CSS-color-name parser. `resolvePaletteAccent` (scenes/color-
 * harmony.ts) returns one of these names (a real per-generation, per-
 * product+backdrop resolved tone, already computed at generation time),
 * never a hex value — this maps it to something renderer.tsx's
 * accentColor can actually use (validated there against
 * /^#[0-9a-fA-F]{6}$/).
 *
 * V1.6: this is the "colour/theme/accent varies by product and backdrop"
 * piece of the sameness fix — every render before this used the same
 * static ClientProfile.accentColor (or the hardcoded ACCENT fallback)
 * regardless of what was actually generated.
 */
const NAMED_COLOR_HEX: Record<string, string> = {
  // palette.accent vocabulary
  emerald: "#1F7A5C",
  "sapphire blue": "#2A5CA8",
  "blush pink": "#E8A9B0",
  "antique gold": "#B08D3D",
  "royal blue": "#2647A6",
  magenta: "#B23A6B",
  gold: "#C9A227",
  coral: "#E2725B",
  "warm amber": "#C97C2C",
  "sage green": "#7C8B6E",
  "dusty rose": "#C08587",
  "bold cobalt": "#1E4FA6",
  "acid green": "#8FAE3D",
  terracotta: "#B8622A",
  "warm brass": "#A67C3D",
  "deep olive green": "#5B6B3E",
  "muted navy": "#33415C",
  "soft teal": "#4E8B8B",
  // palette.base vocabulary (resolvePaletteAccent's fallback when the
  // garment colour is unset, or when a scene's whole accent pool is
  // filtered out by its own `avoid` list)
  "warm ivory": "#E8DCC8",
  "soft gold": "#D4B96A",
  champagne: "#E8D9B5",
  "deep terracotta": "#9C4A26",
  "burnished gold": "#B8963E",
  "soft ivory": "#EFE7D8",
  "sandy beige": "#D8C4A0",
  "sky blue": "#A8C8D8",
  "warm taupe": "#A9967E",
  "brushed brass": "#B5985A",
  "seamless charcoal": "#3A3532",
  "seamless ivory": "#EDE6D6",
  "muted terracotta": "#B0704A",
  "warm stone grey": "#8A8378",
  "sandy taupe": "#B8A585",
  "weathered concrete": "#9C9488",
  "cool slate grey": "#6E7580",
  "warm white": "#F2EEE6",
  "brushed steel": "#8C949C",
  "soft sand": "#D9C7A8",
  "muted clay": "#B08668",
};

/** Null for an unrecognized name (a scene's palette vocabulary grew without
 * this table being updated) — callers fall back to the next link in the
 * accent-resolution chain rather than guessing a color. */
export function paletteColorNameToHex(name: string | null | undefined): string | null {
  if (!name) return null;
  return NAMED_COLOR_HEX[name.trim().toLowerCase()] ?? null;
}

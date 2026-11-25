// Colour configuration for the Mentis Coming Soon page.
// CSS custom properties are the single source of truth; the values below are
// only the defaults.

export const COLOUR_PARAMETERS = [
  { key: "primaryBackground", number: "01", label: "Primary Background", cssVar: "--mentis-primary-background" },
  { key: "generalText", number: "02", label: "General Text", cssVar: "--mentis-general-text" },
  { key: "comingSoonText", number: "03", label: "Coming Soon Text", cssVar: "--mentis-coming-soon-text" },
  { key: "wordEmphasis", number: "04", label: "Animated Word Emphasis", cssVar: "--mentis-word-emphasis" },
  { key: "taglineBackground", number: "05", label: "Tagline Highlight Background", cssVar: "--mentis-tagline-background" },
  { key: "taglineText", number: "06", label: "Tagline Text", cssVar: "--mentis-tagline-text" },
] as const;

export type ColourKey = (typeof COLOUR_PARAMETERS)[number]["key"];
export type ColourConfig = Record<ColourKey, string>;

/** Chosen palette (light background). Edit here to change the shipped colours. */
export const DEFAULT_COLOURS: ColourConfig = {
  primaryBackground: "#F4EEF5",
  generalText: "#4D1327",
  comingSoonText: "#9A30A6",
  wordEmphasis: "#C51C37",
  taglineBackground: "#C51C37",
  taglineText: "#E4F778",
};

/** Inline-style map of CSS variables for the theme root element. */
export function themeCssVariables(colours: ColourConfig): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const p of COLOUR_PARAMETERS) vars[p.cssVar] = colours[p.key];
  return vars;
}

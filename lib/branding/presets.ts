/**
 * Closed set of Mentis-curated "mood" presets for white-labeled client
 * deployments. A client picks/is assigned one preset — never freeform CSS —
 * so every deployment keeps the same underlying structure (spacing, radius,
 * gradient-vs-flat, shadow depth) and only the brand color + logo differ.
 * "default" is today's indigo/purple look — used whenever a ClientProfile
 * has no row (see lib/client-modules.ts) or sets no explicit preset.
 */
export const THEME_PRESETS = {
  default: {
    primary: "#6366f1",
    primaryEnd: "#9333ea",
    radius: "1rem",
    shadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  royal: {
    primary: "#7c2d12",
    primaryEnd: "#a16207",
    radius: "0.5rem",
    shadow: "0 4px 14px rgba(124,45,18,0.18)",
  },
  elegant: {
    primary: "#1f2937",
    primaryEnd: "#1f2937",
    radius: "0.25rem",
    shadow: "none",
  },
} as const;

export type ThemePresetKey = keyof typeof THEME_PRESETS;

export function isThemePresetKey(value: string): value is ThemePresetKey {
  return value in THEME_PRESETS;
}

export interface BrandTheme {
  brandName: string | null;
  primary: string;
  primaryEnd: string;
  radius: string;
  shadow: string;
}

/**
 * Resolves a ClientProfile's theming fields into a concrete BrandTheme.
 * accentColor, when set, overrides only the primary hue slot within the
 * chosen preset's shape — the preset itself always owns radius/shadow.
 */
export function resolveBrandTheme(profile: {
  brandName: string | null;
  themePreset: string;
  accentColor: string | null;
} | null): BrandTheme {
  const preset = profile && isThemePresetKey(profile.themePreset)
    ? THEME_PRESETS[profile.themePreset]
    : THEME_PRESETS.default;

  return {
    brandName: profile?.brandName ?? null,
    primary: profile?.accentColor || preset.primary,
    primaryEnd: profile?.accentColor || preset.primaryEnd,
    radius: preset.radius,
    shadow: preset.shadow,
  };
}

/** CSS custom properties for the resolved theme, spreadable into a style attribute. */
export function brandThemeCssVars(theme: BrandTheme): Record<string, string> {
  return {
    "--brand-primary": theme.primary,
    "--brand-primary-end": theme.primaryEnd,
    "--brand-radius": theme.radius,
    "--brand-shadow": theme.shadow,
  };
}

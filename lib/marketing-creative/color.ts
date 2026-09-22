/**
 * Small pure color helpers for the split-panel renderer — no dependency,
 * plain arithmetic. Used to derive a light panel-background tint from a
 * retailer's ClientProfile.accentColor (the panel itself stays a solid
 * fill; the price banner uses the accent color as-is).
 */

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

/** Mixes a hex color toward white by `amount` (0-1). Returns a neutral
 * fallback for anything that isn't a valid 6-digit hex string. */
export function lightenHex(hex: string | null | undefined, amount: number): string {
  const fallback = "#f2ece1";
  if (!hex || !isValidHex(hex)) return fallback;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const mix = (channel: number) => clamp255(channel + (255 - channel) * amount);

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/** "champagne beige" → "Champagne Beige" — presentation-only title casing. */
export function formatLabel(raw: string): string {
  return raw
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Deterministic colorHex -> colorFamily bucketing (warm_neutral | cool |
 * pastel | earth | jewel | monochrome) — see HmProduct.colorFamily's doc
 * comment in prisma/schema.prisma: "SYSTEM_CALCULATE ... pure colour math,
 * cheaper and more reliable than a model call." Independently implemented
 * for this domain — never imports lib/matching-engine/color-harmony.ts,
 * which is protected fashion-domain IP (CLAUDE.md §4, docs/home-material/
 * domain/data-model.md's "not shared" list).
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    default:
      h = ((r - g) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function deriveColorFamily(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const { h, s, l } = hsl;

  if (s < 12) return "monochrome";
  if (l > 78 && s < 45) return "pastel";
  if (s >= 45 && l >= 25 && l <= 55) return "jewel";
  if (h >= 20 && h <= 90 && s >= 20 && l <= 60) return "earth";
  if (h > 90 && h < 300) return "cool";
  return "warm_neutral";
}

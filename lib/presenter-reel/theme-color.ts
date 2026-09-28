/**
 * Extracts an accent color from the video's settled freeze-frame — the
 * fix for the end card's old hardcoded #161616/#ffd166 palette (research/
 * presenter-reel-content-strategy.html's "End card v2" section). Uses
 * sharp's dominant-color stat (zero AI cost — the same technique
 * lib/branding/extract-color.ts already uses for logo colors), but
 * center-weighted rather than whole-frame: a real gotcha found while
 * building the plan's mockup was that Veo's own letterbox bars drag a
 * naive whole-frame sample toward near-black, and sharp's own trim()
 * didn't reliably strip them either. A center-weighted crop works because
 * the presenter's medium-shot framing is a fixed, documented convention
 * (centered, ~60% of frame height, per ai-presenter-reel-reverse-
 * engineering.html's replication parameters) — so this crop reliably
 * lands on garment/skin tones instead of backdrop or black bars.
 */
import sharp from "sharp";

export interface ThemeColor {
  accentHex: string;
  /** Whether the frame's overall tone is dark enough that white text stays legible once it's blurred and sits underneath the card content. */
  isDarkBackground: boolean;
}

function toHexColor(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const FALLBACK: ThemeColor = { accentHex: "#c9a227", isDarkBackground: true };

export async function extractThemeColor(framePngPath: string): Promise<ThemeColor> {
  try {
    const meta = await sharp(framePngPath).metadata();
    const width = meta.width ?? 720;
    const height = meta.height ?? 1280;

    const centerRegion = await sharp(framePngPath)
      .extract({
        left: Math.round(width * 0.3),
        top: Math.round(height * 0.35),
        width: Math.round(width * 0.4),
        height: Math.round(height * 0.4),
      })
      .toBuffer();
    const centerStats = await sharp(centerRegion).stats();
    const accentHex = toHexColor(centerStats.dominant.r, centerStats.dominant.g, centerStats.dominant.b);

    const wholeStats = await sharp(framePngPath).stats();
    const { r, g, b } = wholeStats.dominant;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    return { accentHex, isDarkBackground: luminance < 140 };
  } catch (err) {
    console.error("[presenter-reel] theme color extraction failed — using fallback palette:", err);
    return FALLBACK;
  }
}

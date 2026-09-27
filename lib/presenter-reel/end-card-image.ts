/**
 * Renders EndCardContent into a static 720x1280 PNG — hand-built SVG
 * rasterized via sharp, deliberately NOT the Satori/resvg renderer
 * lib/marketing-creative/ uses: that module lives on a separate, unmerged
 * branch (feature/marketing-creative-generation) and its dependencies
 * (satori, @resvg/resvg-js, @fontsource/inter) aren't installed here. sharp
 * is already a project dependency and rasterizes SVG natively, so this needs
 * zero new packages — a deliberate scope choice, not an oversight.
 *
 * 720x1280 matches veo-presenter-provider.ts's fixed output dimensions
 * exactly, so the card drops into the video-finishing pipeline with no
 * scaling.
 */
import sharp from "sharp";
import type { EndCardContent } from "./end-card";

const WIDTH = 720;
const HEIGHT = 1280;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Simple greedy word wrap — good enough for short product headlines/bullets, not general typesetting. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderEndCardPng(content: EndCardContent): Promise<Buffer> {
  const parts: string[] = [`<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#161616"/>`];

  let y = 460;
  for (const line of wrapText(content.headline, 24).slice(0, 3)) {
    parts.push(
      `<text x="60" y="${y}" font-family="sans-serif" font-size="46" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`
    );
    y += 58;
  }

  y += 30;
  for (const bullet of content.bullets) {
    const lines = wrapText(bullet, 34);
    for (const [i, line] of lines.entries()) {
      const prefixed = i === 0 ? `•  ${line}` : `    ${line}`;
      parts.push(`<text x="60" y="${y}" font-family="sans-serif" font-size="28" fill="#e6e6e6">${escapeXml(prefixed)}</text>`);
      y += 38;
    }
    y += 10;
  }

  if (content.price) {
    y += 24;
    const { amount, mrp, discountPercent } = content.price;
    if (mrp && mrp > amount) {
      parts.push(
        `<text x="60" y="${y}" font-family="sans-serif" font-size="26" fill="#9a9a9a" text-decoration="line-through">Rs. ${Math.round(mrp)}</text>`
      );
      y += 44;
    }
    const priceLine = discountPercent ? `Rs. ${Math.round(amount)}  (${discountPercent}% OFF)` : `Rs. ${Math.round(amount)}`;
    parts.push(
      `<text x="60" y="${y}" font-family="sans-serif" font-size="40" font-weight="700" fill="#ffd166">${escapeXml(priceLine)}</text>`
    );
  }

  if (content.ctaText) {
    const ctaY = HEIGHT - 100;
    parts.push(`<rect x="60" y="${ctaY - 46}" width="${WIDTH - 120}" height="70" rx="35" fill="#ffffff"/>`);
    parts.push(
      `<text x="${WIDTH / 2}" y="${ctaY}" font-family="sans-serif" font-size="30" font-weight="700" fill="#161616" text-anchor="middle">${escapeXml(content.ctaText)}</text>`
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${parts.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

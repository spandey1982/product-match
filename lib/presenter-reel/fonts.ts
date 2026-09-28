/**
 * Loads font buffers for the Satori-rendered end card. Inter for every
 * non-title element (kicker, bullets, price, CTA) — same file/weight
 * shape as lib/marketing-creative/fonts.ts, not imported from there since
 * that module also loads the Italic weight this feature doesn't use and
 * keeping the two font sets independent avoids a shared-cache coupling
 * between two otherwise-separate features. The two title-only display
 * fonts (research/presenter-reel-content-strategy.html's "Two fonts, both
 * adopted" decision, 2026-09-28) are the new part: Fraunces for
 * "contemporary" mood, Playfair Display for "heritage" mood — see
 * typography-mood.ts for how a product resolves to one or the other.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Font } from "satori";

const NODE_MODULES = join(process.cwd(), "node_modules");

let cached: Promise<Font[]> | null = null;

export function loadPresenterReelFonts(): Promise<Font[]> {
  if (!cached) {
    const inter = join(NODE_MODULES, "@fontsource", "inter", "files");
    const fraunces = join(NODE_MODULES, "@fontsource", "fraunces", "files");
    const playfair = join(NODE_MODULES, "@fontsource", "playfair-display", "files");

    cached = Promise.all([
      readFile(join(inter, "inter-latin-400-normal.woff")),
      readFile(join(inter, "inter-latin-ext-400-normal.woff")),
      readFile(join(inter, "inter-latin-700-normal.woff")),
      readFile(join(inter, "inter-latin-ext-700-normal.woff")),
      readFile(join(fraunces, "fraunces-latin-600-normal.woff")),
      readFile(join(fraunces, "fraunces-latin-ext-600-normal.woff")),
      readFile(join(playfair, "playfair-display-latin-700-normal.woff")),
      readFile(join(playfair, "playfair-display-latin-ext-700-normal.woff")),
    ]).then(([interReg, interRegExt, interBold, interBoldExt, fraunces600, fraunces600Ext, playfair700, playfair700Ext]) => [
      { name: "Inter", data: interReg, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: interRegExt, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
      { name: "Inter", data: interBoldExt, weight: 700 as const, style: "normal" as const },
      { name: "Fraunces", data: fraunces600, weight: 600 as const, style: "normal" as const },
      { name: "Fraunces", data: fraunces600Ext, weight: 600 as const, style: "normal" as const },
      { name: "Playfair Display", data: playfair700, weight: 700 as const, style: "normal" as const },
      { name: "Playfair Display", data: playfair700Ext, weight: 700 as const, style: "normal" as const },
    ]);
  }
  return cached;
}

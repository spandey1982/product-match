/**
 * Loads the Regular + Bold font buffers Satori needs to render text
 * deterministically. Buffers only, read from the bundled @fontsource/inter
 * npm package (installed as a real dependency, not fetched at runtime from
 * an external CDN) — this is precisely why Satori was chosen for the
 * overlay renderer: no system-font/fontconfig dependency on the Railway
 * container, and no runtime network dependency either. Satori supports
 * TTF/OTF/WOFF (not WOFF2) — @fontsource ships legacy .woff alongside
 * .woff2, which is what's read here.
 *
 * V1 ships one font family (Inter, Regular + Bold) rather than a per-brand-
 * tier typography system — per-brand typography is an explicit Brand
 * Creative Profile field noted in the research for a later phase, not V1
 * (report Part 5.2 lists it among fields not yet needed for V1's two
 * highest-leverage fields, brandTier/priceVisibility).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Font } from "satori";

const FONT_DIR = join(process.cwd(), "node_modules", "@fontsource", "inter", "files");

let cached: Promise<Font[]> | null = null;

export function loadCreativeFonts(): Promise<Font[]> {
  if (!cached) {
    cached = Promise.all([
      readFile(join(FONT_DIR, "inter-latin-400-normal.woff")),
      readFile(join(FONT_DIR, "inter-latin-ext-400-normal.woff")),
      readFile(join(FONT_DIR, "inter-latin-700-normal.woff")),
      readFile(join(FONT_DIR, "inter-latin-ext-700-normal.woff")),
    ]).then(([regular, regularExt, bold, boldExt]) => [
      { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: regularExt, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Inter", data: boldExt, weight: 700 as const, style: "normal" as const },
    ]);
  }
  return cached;
}

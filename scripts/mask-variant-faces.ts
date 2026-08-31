/**
 * Face-mask preprocessing — TEAM TOOL, never runs at request time.
 *
 * Produces face-masked variants of the curated front-view reference assets so
 * that AI Casting's face identity reference is the SOLE face source. Without
 * masking, the fused variant ref (e.g. woman-saree-front.*) carries its
 * own face; sending that alongside a face identity ref creates a two-face-
 * source conflict. lib/model-gen/prompt-sets.ts's buildViewPrompt now tells
 * Gemini outright to ignore the drape reference's face/skin/pose/lighting
 * (the prompt half of the mitigation); this script mitigates the pixel half,
 * since a text instruction alone doesn't fully suppress what a raw reference
 * image conditions on.
 *
 * Deterministic — no AI calls, no cost. Sharp gaussian-blurs a soft-edged
 * face region on each front view and writes `-masked.webp` alongside the
 * original. The reference loader (lib/model-gen/reference-models.ts) prefers
 * the masked variant when a face identity ref is present at generation time.
 *
 * Usage:
 *   npx tsx scripts/mask-variant-faces.ts                # all configured
 *   npx tsx scripts/mask-variant-faces.ts --force        # overwrite existing
 *   npx tsx scripts/mask-variant-faces.ts --only=woman-saree-front
 *
 * Back views are NOT masked — the model is turned around and the face is
 * either absent or in profile with minimal identity signal. Kids assets
 * (girl/boy) are also skipped because kids products bypass Casting.
 */
import { access, constants } from "fs/promises";
import { basename, join } from "path";
import sharp from "sharp";

const REF_DIR = join(process.cwd(), "public", "reference-models");

/**
 * Face bounding box per asset, as fractions of image dimensions (top-left
 * origin). The current curated set follows a consistent full-body catalogue
 * framing — face is upper-centre, roughly 15% wide and 12% tall — so per-file
 * variation is small. Feathering (see FEATHER_FRACTION) hides the last bit
 * of imprecision.
 */
interface MaskRect {
  /** Basename WITHOUT extension — the source may ship as png/jpg/webp and
   *  the curated set has changed extension before (e.g. the Rev. 4 realism
   *  regeneration switched the woman-*-front files from .png to .jpg); a
   *  hardcoded extension here would silently skip every file the moment the
   *  source format changes, since exists() would look for a name nothing
   *  matches. TRY_EXTS below resolves the real one. */
  base: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const MASK_CONFIG: readonly MaskRect[] = [
  { base: "woman-base-front",    x: 0.41, y: 0.06, w: 0.20, h: 0.14 },
  { base: "woman-saree-front",   x: 0.41, y: 0.07, w: 0.20, h: 0.13 },
  { base: "woman-lehenga-front", x: 0.41, y: 0.06, w: 0.20, h: 0.14 },
  { base: "woman-kurti-front",   x: 0.41, y: 0.07, w: 0.20, h: 0.14 },
  // Man's frame has more head-on-shoulder detail; extend the box downward
  // through the beard region so identity cues in the lower face also blur.
  { base: "man-base-front",      x: 0.40, y: 0.04, w: 0.23, h: 0.21 },
];

const TRY_EXTS = ["webp", "png", "jpg", "jpeg"] as const;

/** Gaussian blur sigma applied to the extracted face region. */
const BLUR_SIGMA = 55;
/** Feather radius as a fraction of the smaller face-region side. */
const FEATHER_FRACTION = 0.18;

/** Argument helpers. */
const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length) : null;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveSource(base: string): Promise<string | null> {
  for (const ext of TRY_EXTS) {
    const p = join(REF_DIR, `${base}.${ext}`);
    if (await exists(p)) return p;
  }
  return null;
}

function outPath(base: string): string {
  return join(REF_DIR, `${base}-masked.webp`);
}

async function maskOne(cfg: MaskRect): Promise<void> {
  const src = await resolveSource(cfg.base);
  const dst = outPath(cfg.base);

  if (!src) {
    console.warn(`⚠ source missing: ${cfg.base}.{${TRY_EXTS.join("|")}}`);
    return;
  }
  if (!force && (await exists(dst))) {
    console.log(`· skip (exists): ${cfg.base}`);
    return;
  }

  const meta = await sharp(src).metadata();
  if (!meta.width || !meta.height) {
    console.error(`✗ cannot read metadata for ${cfg.base}`);
    return;
  }
  const W = meta.width;
  const H = meta.height;

  const x = Math.round(cfg.x * W);
  const y = Math.round(cfg.y * H);
  const w = Math.round(cfg.w * W);
  const h = Math.round(cfg.h * H);
  const feather = Math.max(4, Math.round(Math.min(w, h) * FEATHER_FRACTION));

  // Heavy blur on the extracted face region — features become
  // unrecognizable while overall colour and silhouette blend with the
  // surrounding image.
  const blurred = await sharp(src)
    .extract({ left: x, top: y, width: w, height: h })
    .blur(BLUR_SIGMA)
    .png()
    .toBuffer();

  // Soft-edged rectangular alpha mask: a white rounded rect with a large
  // gaussian blur. Composited onto the blurred region with `dest-in` so the
  // region fades to fully transparent at its edges — no visible seams.
  const softMask = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <filter id="f" x="-50%" y="-50%" width="200%" height="200%">
           <feGaussianBlur stdDeviation="${feather}"/>
         </filter>
       </defs>
       <rect x="${feather}" y="${feather}" width="${w - 2 * feather}" height="${h - 2 * feather}" rx="${feather}" ry="${feather}" fill="white" filter="url(#f)"/>
     </svg>`
  );

  const feathered = await sharp(blurred)
    .ensureAlpha()
    .composite([{ input: softMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  // Composite the feathered blur back onto the original at the same offset.
  // Output as high-quality webp — matches the preprocess.ts encoding choice.
  await sharp(src)
    .composite([{ input: feathered, left: x, top: y }])
    .webp({ quality: 92, effort: 4 })
    .toFile(dst);

  console.log(`✓ ${basename(src)} → ${cfg.base}-masked.webp`);
}

async function main() {
  const jobs = only
    ? MASK_CONFIG.filter((c) => c.base.startsWith(only))
    : MASK_CONFIG;
  if (jobs.length === 0) {
    console.error(`No matching assets for --only=${only}`);
    process.exit(1);
  }
  for (const cfg of jobs) {
    try {
      await maskOne(cfg);
    } catch (err) {
      console.error(`✗ ${cfg.base}:`, err);
    }
  }
}

main();

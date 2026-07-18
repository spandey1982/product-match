/**
 * Face-mask preprocessing — TEAM TOOL, never runs at request time.
 *
 * Produces face-masked variants of the curated front-view reference assets so
 * that AI Casting's face identity reference is the SOLE face source. Without
 * masking, the fused variant ref (e.g. woman-saree-front.png) carries its
 * own face; sending that alongside a face identity ref creates a two-face-
 * source conflict in the prompt (see lib/model-gen/prompt-sets.ts's
 * `hasIdentityReference` clause which mitigates the prompt half; this script
 * mitigates the pixel half).
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
import { join } from "path";
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
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const MASK_CONFIG: readonly MaskRect[] = [
  { file: "woman-base-front.png",    x: 0.41, y: 0.06, w: 0.20, h: 0.14 },
  { file: "woman-saree-front.png",   x: 0.41, y: 0.07, w: 0.20, h: 0.13 },
  { file: "woman-lehenga-front.png", x: 0.41, y: 0.06, w: 0.20, h: 0.14 },
  { file: "woman-kurti-front.png",   x: 0.41, y: 0.07, w: 0.20, h: 0.14 },
  // Man's frame has more head-on-shoulder detail; extend the box downward
  // through the beard region so identity cues in the lower face also blur.
  { file: "man-base-front.png",      x: 0.40, y: 0.04, w: 0.23, h: 0.21 },
];

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

function outPath(srcFile: string): string {
  return join(REF_DIR, srcFile.replace(/\.(png|jpg|jpeg|webp)$/i, "-masked.webp"));
}

async function maskOne(cfg: MaskRect): Promise<void> {
  const src = join(REF_DIR, cfg.file);
  const dst = outPath(cfg.file);

  if (!(await exists(src))) {
    console.warn(`⚠ source missing: ${cfg.file}`);
    return;
  }
  if (!force && (await exists(dst))) {
    console.log(`· skip (exists): ${cfg.file}`);
    return;
  }

  const meta = await sharp(src).metadata();
  if (!meta.width || !meta.height) {
    console.error(`✗ cannot read metadata for ${cfg.file}`);
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

  console.log(`✓ ${cfg.file} → ${cfg.file.replace(/\.\w+$/, "-masked.webp")}`);
}

async function main() {
  const jobs = only
    ? MASK_CONFIG.filter((c) => c.file.startsWith(only))
    : MASK_CONFIG;
  if (jobs.length === 0) {
    console.error(`No matching assets for --only=${only}`);
    process.exit(1);
  }
  for (const cfg of jobs) {
    try {
      await maskOne(cfg);
    } catch (err) {
      console.error(`✗ ${cfg.file}:`, err);
    }
  }
}

main();

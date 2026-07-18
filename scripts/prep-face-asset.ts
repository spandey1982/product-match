/**
 * Prep a curated real photo for the face library — TEAM TOOL, one-off.
 *
 * Two modes:
 *
 * 1. SMART CROP (recommended). Provide face bounds in source coords and the
 *    script computes the 4:5 crop that places the face at the target head-
 *    and-shoulders framing used by the AI-generated library entries (~12%
 *    top margin above hair, face height ~35% of frame). Works from ANY
 *    source framing — close-up, half-body, or full-body — because the
 *    crop is derived from the face position, not the source frame.
 *
 *    When the source doesn't have enough headroom (close-up shots where
 *    the hair touches the top edge), the script samples background colour
 *    from a source corner and EXTENDS the canvas upward with that colour
 *    before cropping. On a plain-studio source the extension is seamless.
 *
 * 2. LEGACY DUMB CROP (--top-offset only). Just crops 4:5 from the top
 *    with a fixed offset. Kept for cases where the source is already
 *    framed correctly. This is what the previous version did.
 *
 * Output is always 928×1152 JPEG q90 — matches the AI-generated siblings.
 *
 * Usage:
 *   Smart mode:
 *     npx tsx scripts/prep-face-asset.ts --src=./tmp/photo.jpg --id=east-m-1 \
 *       --face-top=0.05 --face-bottom=0.48 --face-x=0.52 --force
 *
 *   Face bounds are measured in the source: --face-top is the fraction of
 *   source height where the very top of the hair sits (0 = image top).
 *   --face-bottom is where the chin sits. --face-x is the horizontal
 *   centre of the face (default 0.5). Any image viewer that shows pixel
 *   coordinates on hover will do — no measuring tool required, eyeballing
 *   to ±2% is fine.
 *
 *   Legacy mode:
 *     npx tsx scripts/prep-face-asset.ts --src=./tmp/photo.jpg --id=east-m-1 \
 *       --top-offset=0.05 --force
 *
 *   Options common to both:
 *     --target-face-h=0.35     Target face height as fraction of output (tune framing)
 *     --target-face-top=0.12   Target top-margin above hair (tune framing)
 *     --force                  Legacy-rename existing before writing (never overwrites)
 *
 * Never overwrites: on --force the existing asset moves to
 *   {id}-legacy-{timestamp}.{ext}
 */
import "dotenv/config";
import { access, mkdir, rename, stat } from "fs/promises";
import { isAbsolute, join } from "path";
import sharp from "sharp";

const TARGET_WIDTH = 928;
const TARGET_HEIGHT = 1152;
const TARGET_ASPECT = TARGET_WIDTH / TARGET_HEIGHT; // 0.8056
const JPEG_QUALITY = 90;
const TRY_EXTS = ["webp", "png", "jpg", "jpeg"] as const;
const OUT_DIR = join(process.cwd(), "public", "reference-models", "faces");

/**
 * Target head-and-shoulders framing constants — measured from the AI-
 * generated library (north-f-1, north-east-m-1, etc.). Tweak via CLI if
 * a specific source needs it, but these are sensible defaults across the
 * whole library so curated photos land visually consistent with the
 * generated ones.
 */
const DEFAULT_TARGET_FACE_HEIGHT = 0.35;  // face takes 35% of output height
const DEFAULT_TARGET_FACE_TOP = 0.12;     // 12% blank margin above hair
const EXTEND_LIMIT_FRACTION = 0.5;        // safety: refuse to extend more than 50% of src dim

// ── Arg parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function argVal(name: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : undefined;
}

const srcRaw = argVal("src");
const id = argVal("id");

// Smart-mode inputs
const faceTop = argVal("face-top") ? parseFloat(argVal("face-top")!) : null;
const faceBottom = argVal("face-bottom") ? parseFloat(argVal("face-bottom")!) : null;
const faceX = argVal("face-x") ? parseFloat(argVal("face-x")!) : 0.5;

// Framing tuners (both modes)
const targetFaceHeight = parseFloat(argVal("target-face-h") ?? String(DEFAULT_TARGET_FACE_HEIGHT));
const targetFaceTop = parseFloat(argVal("target-face-top") ?? String(DEFAULT_TARGET_FACE_TOP));

// Legacy-mode inputs
const topOffset = parseFloat(argVal("top-offset") ?? "0.05");
const centerCrop = args.includes("--center");

const force = args.includes("--force");

const smartMode = faceTop !== null && faceBottom !== null;

if (!srcRaw || !id) {
  console.error(
    "Usage:\n" +
    "  Smart:  npx tsx scripts/prep-face-asset.ts --src=<path> --id=<face-id> --face-top=<0..1> --face-bottom=<0..1> [--face-x=<0..1>] [--force]\n" +
    "  Legacy: npx tsx scripts/prep-face-asset.ts --src=<path> --id=<face-id> [--top-offset=<0..1>] [--center] [--force]"
  );
  process.exit(1);
}
if (smartMode && (faceTop! >= faceBottom!)) {
  console.error("--face-top must be less than --face-bottom");
  process.exit(1);
}

const srcPath = isAbsolute(srcRaw) ? srcRaw : join(process.cwd(), srcRaw);

// ── Helpers ────────────────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

/**
 * Sample the top-left corner of the source to guess a background colour.
 * Averaged over a small patch so a single noisy pixel doesn't win. Used
 * only when the crop needs to extend past the source's edges.
 */
async function sampleBgColor(buffer: Buffer, w: number, h: number): Promise<{ r: number; g: number; b: number }> {
  const patch = Math.max(16, Math.round(Math.min(w, h) * 0.02));
  const { data } = await sharp(buffer)
    .extract({ left: 0, top: 0, width: patch, height: patch })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0;
  const pixelCount = patch * patch;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  return {
    r: Math.round(r / pixelCount),
    g: Math.round(g / pixelCount),
    b: Math.round(b / pixelCount),
  };
}

// ── Crop planners ──────────────────────────────────────────────────────────

interface Crop { left: number; top: number; width: number; height: number; }
interface Extend { top: number; bottom: number; left: number; right: number; }

/**
 * SMART: place the face at the target framing regardless of source framing.
 * Returns the crop rectangle to apply AFTER any canvas extension is done.
 */
function planSmartCrop(
  srcW: number,
  srcH: number,
  ftop: number,
  fbottom: number,
  fx: number
): { crop: Crop; extend: Extend } {
  const faceTopPx = srcH * ftop;
  const faceBottomPx = srcH * fbottom;
  const faceCenterXPx = srcW * fx;
  const faceHeightPx = faceBottomPx - faceTopPx;

  // Crop height in source pixels: face fills targetFaceHeight fraction of it.
  const cropHeight = Math.round(faceHeightPx / targetFaceHeight);
  const cropWidth = Math.round(cropHeight * TARGET_ASPECT);

  // Position crop so face top lands at targetFaceTop fraction of crop.
  const idealCropTop = Math.round(faceTopPx - cropHeight * targetFaceTop);
  const idealCropLeft = Math.round(faceCenterXPx - cropWidth / 2);
  const idealCropBottom = idealCropTop + cropHeight;
  const idealCropRight = idealCropLeft + cropWidth;

  // Determine how far past the source edges the ideal crop reaches; those
  // become canvas extensions (background pad) so the crop fits without
  // repositioning the face.
  const extend: Extend = {
    top: Math.max(0, -idealCropTop),
    bottom: Math.max(0, idealCropBottom - srcH),
    left: Math.max(0, -idealCropLeft),
    right: Math.max(0, idealCropRight - srcW),
  };

  // Safety: if we'd have to extend more than EXTEND_LIMIT_FRACTION of source
  // dimensions, that's usually a sign the face bounds are wrong. Warn but
  // proceed — the user can rerun with different bounds if the result is off.
  const maxVerticalExtend = Math.max(extend.top, extend.bottom);
  if (maxVerticalExtend > srcH * EXTEND_LIMIT_FRACTION) {
    console.warn(
      `⚠  Extending source by ${Math.round((maxVerticalExtend / srcH) * 100)}% vertically — ` +
      `check --face-top / --face-bottom are correct.`
    );
  }

  // After extension, the crop origin shifts by the top/left extension amounts.
  const crop: Crop = {
    left: idealCropLeft + extend.left,
    top: idealCropTop + extend.top,
    width: cropWidth,
    height: cropHeight,
  };
  return { crop, extend };
}

/**
 * LEGACY: dumb 4:5 crop from top with an offset. Kept because a few sources
 * are already framed correctly and don't need face-aware processing.
 */
function planLegacyCrop(srcW: number, srcH: number): { crop: Crop | null; extend: Extend } {
  const noExtend = { top: 0, bottom: 0, left: 0, right: 0 };
  const srcAspect = srcW / srcH;
  if (Math.abs(srcAspect - TARGET_ASPECT) < 0.005) {
    return { crop: null, extend: noExtend };
  }
  if (srcAspect > TARGET_ASPECT) {
    const cropWidth = Math.round(srcH * TARGET_ASPECT);
    const left = Math.round((srcW - cropWidth) / 2);
    return { crop: { left, top: 0, width: cropWidth, height: srcH }, extend: noExtend };
  }
  const cropHeight = Math.round(srcW / TARGET_ASPECT);
  let top: number;
  if (centerCrop) {
    top = Math.round((srcH - cropHeight) / 2);
  } else {
    top = Math.round(srcH * topOffset);
    if (top + cropHeight > srcH) top = srcH - cropHeight;
  }
  return { crop: { left: 0, top, width: srcW, height: cropHeight }, extend: noExtend };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!(await fileExists(srcPath))) {
    console.error(`Source not found: ${srcPath}`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${id}.jpg`);

  // Legacy-rename anything that would collide (across all accepted exts).
  const existing: string[] = [];
  for (const ext of TRY_EXTS) {
    const p = join(OUT_DIR, `${id}.${ext}`);
    if (await fileExists(p)) existing.push(p);
  }
  if (existing.length > 0) {
    if (!force) {
      console.error(`${id} already exists on disk. Use --force to legacy-rename and replace.`);
      process.exit(1);
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    for (const p of existing) {
      const ext = p.split(".").pop();
      const legacy = join(OUT_DIR, `${id}-legacy-${ts}.${ext}`);
      await rename(p, legacy);
      console.log(`  · kept previous as ${id}-legacy-${ts}.${ext}`);
    }
  }

  // Materialise EXIF-rotated source once so metadata + pipeline agree on dims.
  const { data: rotatedBuffer, info } = await sharp(srcPath)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const { width: srcW, height: srcH } = info;
  console.log(`Source: ${srcW}×${srcH} (aspect ${(srcW / srcH).toFixed(3)})`);
  console.log(`Mode:   ${smartMode ? "smart (face-bounds)" : "legacy (top-offset)"}`);

  // Plan the crop + any canvas extension.
  const { crop, extend } = smartMode
    ? planSmartCrop(srcW, srcH, faceTop!, faceBottom!, faceX)
    : planLegacyCrop(srcW, srcH);

  const totalExtend = extend.top + extend.bottom + extend.left + extend.right;
  let workingBuffer = rotatedBuffer;
  let workingW = srcW;
  let workingH = srcH;

  if (totalExtend > 0) {
    const bg = await sampleBgColor(rotatedBuffer, srcW, srcH);
    console.log(
      `Extend: t=${extend.top} b=${extend.bottom} l=${extend.left} r=${extend.right} ` +
      `bg=rgb(${bg.r},${bg.g},${bg.b})`
    );
    const extended = await sharp(rotatedBuffer)
      .extend({ ...extend, background: { r: bg.r, g: bg.g, b: bg.b } })
      .toBuffer({ resolveWithObject: true });
    workingBuffer = extended.data;
    workingW = extended.info.width;
    workingH = extended.info.height;
  }

  let pipeline = sharp(workingBuffer);
  if (crop) {
    // Clamp to working canvas just in case rounding pushed us over.
    const left = Math.max(0, Math.min(crop.left, workingW - 1));
    const top = Math.max(0, Math.min(crop.top, workingH - 1));
    const width = Math.min(crop.width, workingW - left);
    const height = Math.min(crop.height, workingH - top);
    console.log(`Crop:   ${width}×${height} at (${left}, ${top}) on ${workingW}×${workingH} canvas`);
    pipeline = pipeline.extract({ left, top, width, height });
  } else {
    console.log("Crop:   none — source is already 4:5");
  }

  await pipeline
    .resize({
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      kernel: sharp.kernel.lanczos3,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(outPath);

  const finalStat = await stat(outPath);
  console.log(
    `\n✓ Wrote ${id}.jpg — ${TARGET_WIDTH}×${TARGET_HEIGHT}, ${Math.round(finalStat.size / 1024)} KB`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

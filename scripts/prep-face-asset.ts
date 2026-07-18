/**
 * Prep a curated real photo for the face library — TEAM TOOL, one-off.
 *
 * Replicates the manual crop workflow:
 *   1. Top edge stays as-is (anchor — headroom is preserved from source).
 *   2. Bottom is cropped at the shoulder line (--crop-bottom).
 *   3. Left/right are cropped to center the face horizontally (--face-x).
 *   4. Width is derived from the cropped height to maintain 4:5 AR.
 *   5. Result is resized to 928×1152 JPEG q90.
 *
 * Works from any source framing — full body, half body, or close-up — as
 * long as the source has proper headroom at the top. For close-ups where
 * the hair is already clipped in the source, crop the source manually
 * first (the script can't recover pixels that don't exist).
 *
 * Usage:
 *   npx tsx scripts/prep-face-asset.ts \
 *     --src=./tmp/photo.jpg \
 *     --id=east-m-1 \
 *     --crop-bottom=0.55 \
 *     --face-x=0.5 \
 *     --force
 *
 * Arguments:
 *   --src           Path to source image (absolute or relative to cwd)
 *   --id            Face library id (e.g. east-m-1)
 *   --crop-bottom   Fraction of source height to keep from the top.
 *                   0.55 means keep the top 55%, discard the bottom 45%.
 *                   Tune this to cut at the shoulder line.
 *   --face-x        Horizontal centre of the face as a fraction of source
 *                   width (0.0 = left edge, 1.0 = right edge, default 0.5).
 *                   The 4:5 crop is centred on this x position.
 *   --force         Legacy-rename any existing {id}.{ext} before writing.
 *
 * Never overwrites: on --force the existing asset moves to
 *   {id}-legacy-{timestamp}.{ext}
 *
 * Output is always 928×1152 JPEG q90 — matches the AI-generated siblings.
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

// ── Arg parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function argVal(name: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : undefined;
}

const srcRaw = argVal("src");
const id = argVal("id");
const cropBottom = parseFloat(argVal("crop-bottom") ?? "1");
const faceX = parseFloat(argVal("face-x") ?? "0.5");
const force = args.includes("--force");

if (!srcRaw || !id) {
  console.error(
    "Usage: npx tsx scripts/prep-face-asset.ts --src=<path> --id=<face-id> --crop-bottom=<0..1> [--face-x=<0..1>] [--force]"
  );
  process.exit(1);
}
if (cropBottom <= 0 || cropBottom > 1) {
  console.error("--crop-bottom must be between 0 (exclusive) and 1 (inclusive).");
  process.exit(1);
}
if (faceX < 0 || faceX > 1) {
  console.error("--face-x must be between 0 and 1.");
  process.exit(1);
}

const srcPath = isAbsolute(srcRaw) ? srcRaw : join(process.cwd(), srcRaw);

// ── Helpers ────────────────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!(await fileExists(srcPath))) {
    console.error(`Source not found: ${srcPath}`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${id}.jpg`);

  // Legacy-rename anything that would collide.
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

  // Materialise EXIF-rotated source.
  const { data: rotatedBuffer, info } = await sharp(srcPath)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const srcW = info.width;
  const srcH = info.height;
  console.log(`Source: ${srcW}×${srcH} (aspect ${(srcW / srcH).toFixed(3)})`);

  // Step 1: Crop height — keep from y=0 down to crop-bottom fraction.
  const cropH = Math.round(srcH * cropBottom);

  // Step 2: Crop width — derived from height to get 4:5 AR.
  const cropW = Math.round(cropH * TARGET_ASPECT);

  // Step 3: Center the width on face-x.
  const faceCenterPx = Math.round(srcW * faceX);
  let left = faceCenterPx - Math.round(cropW / 2);

  // Clamp so we don't go past source edges.
  if (left < 0) left = 0;
  if (left + cropW > srcW) left = srcW - cropW;

  // If the crop is wider than the source (very unlikely for portraits),
  // fall back to using full source width and adjusting height.
  if (cropW > srcW) {
    console.error(
      `Computed crop width (${cropW}) exceeds source width (${srcW}). ` +
      `Increase --crop-bottom to include more of the image, or use a wider source.`
    );
    process.exit(1);
  }

  console.log(`Crop:   ${cropW}×${cropH} at (${left}, 0) — top anchored, face-x at ${(faceX * 100).toFixed(0)}%`);

  await sharp(rotatedBuffer)
    .extract({ left, top: 0, width: cropW, height: cropH })
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

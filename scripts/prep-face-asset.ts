/**
 * Prep a curated real photo for the face library — TEAM TOOL, one-off.
 *
 * Takes a source portrait photo (any format sharp can read) and produces the
 * exact library format the Gemini-generated faces use: 4:5 aspect, 928×1152,
 * JPEG at ~q90 (~650–740 KB). Cropped from the top by default so head and
 * shoulders stay in frame (the usable region for a face reference) while
 * arms / props / watches lower in the source get trimmed out.
 *
 * Usage:
 *   npx tsx scripts/prep-face-asset.ts --src=<path> --id=<face-id>
 *   npx tsx scripts/prep-face-asset.ts --src=./tmp/photo.jpg --id=east-m-1
 *
 * Options:
 *   --top-offset=<0..1>  Fraction of source height to skip above the crop.
 *                        0.05 (default) leaves a small margin above the hair.
 *                        Raise it to tighten around the face; lower it if
 *                        the hair top is being cut.
 *   --center             Center the 4:5 crop vertically instead of top-
 *                        biased. Useful when the head is centered in-frame.
 *   --force              Legacy-rename any existing {id}.{ext} before writing.
 *
 * Never overwrites: on --force the existing asset moves to
 *   {id}-legacy-{timestamp}.{ext}
 * so old picks stay on disk for comparison / revert.
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
const topOffset = parseFloat(argVal("top-offset") ?? "0.05");
const centerCrop = args.includes("--center");
const force = args.includes("--force");

if (!srcRaw || !id) {
  console.error(
    "Usage: npx tsx scripts/prep-face-asset.ts --src=<path> --id=<face-id> [--top-offset=0.05] [--center] [--force]"
  );
  process.exit(1);
}

const srcPath = isAbsolute(srcRaw) ? srcRaw : join(process.cwd(), srcRaw);

// ── Helpers ────────────────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

interface Crop { left: number; top: number; width: number; height: number; }

/**
 * Compute the 4:5 crop rectangle inside a source of (w × h). When the source
 * is *taller* than 4:5 (typical portrait photo), crops height from the top
 * with the configured offset. When it's *wider*, centers horizontally.
 */
function planCrop(w: number, h: number): Crop | null {
  const srcAspect = w / h;
  if (Math.abs(srcAspect - TARGET_ASPECT) < 0.005) {
    return null; // already 4:5, no crop needed
  }
  if (srcAspect > TARGET_ASPECT) {
    // Wider than target → crop width, keep full height.
    const cropWidth = Math.round(h * TARGET_ASPECT);
    const left = Math.round((w - cropWidth) / 2);
    return { left, top: 0, width: cropWidth, height: h };
  }
  // Taller than target → crop height, keep full width.
  const cropHeight = Math.round(w / TARGET_ASPECT);
  let top: number;
  if (centerCrop) {
    top = Math.round((h - cropHeight) / 2);
  } else {
    top = Math.round(h * topOffset);
    if (top + cropHeight > h) top = h - cropHeight;
  }
  return { left: 0, top, width: w, height: cropHeight };
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

  // Materialise EXIF-rotated source once so both metadata and pipeline agree
  // on dimensions (metadata() alone reports pre-rotation dims).
  const { data: rotatedBuffer, info } = await sharp(srcPath)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const { width: srcW, height: srcH } = info;
  const srcAspect = srcW / srcH;
  console.log(`Source: ${srcW}×${srcH} (aspect ${srcAspect.toFixed(3)})`);

  const crop = planCrop(srcW, srcH);
  let pipeline = sharp(rotatedBuffer);
  if (crop) {
    console.log(`Crop:   ${crop.width}×${crop.height} at (${crop.left}, ${crop.top})`);
    pipeline = pipeline.extract(crop);
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

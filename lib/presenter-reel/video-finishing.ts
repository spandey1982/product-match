/**
 * Finishes a raw Veo presenter clip. In "hook_end_card" delivery mode:
 * selects a settled freeze-frame (freeze-frame.ts — fixes the "looks
 * mid-sentence" problem), trims the clip there, and appends a blur-ramp
 * tail — the settled frame holds, blurs progressively over ~0.5s, and the
 * theme-colored (theme-color.ts), mood-typeset (end-card-renderer.tsx)
 * info card fades in on top. This replaces the earlier crossfade into a
 * flat solid card, which visibly collided with the crisp video instead of
 * reading as part of it (research/presenter-reel-content-strategy.html's
 * "End card v2" section has the full before/after).
 *
 * Always (both delivery modes): burns in the AI-disclosure label and, when
 * requested, an on-screen CTA, via ffmpeg drawtext, in one pass over
 * whatever the pipeline above produced.
 *
 * Same defensive philosophy throughout as the code this supersedes
 * (disclosure-overlay.ts, then the first version of this file): every
 * stage is attempted, and a failure degrades to the previous good stage
 * rather than failing the whole render. The one exception is losing the
 * disclosure label entirely — that's a compliance gap, not missed polish,
 * so it's logged loudly rather than silently swallowed.
 */
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";
import { runFfmpeg } from "@/lib/catalogue-motion/ffmpeg";
import { selectFreezeFrameTime } from "./freeze-frame";
import { extractThemeColor } from "./theme-color";
import { renderEndCardPng } from "./end-card-renderer";
import type { EndCardContent } from "./end-card";
import type { TimingMode } from "./duration-budget";

const DISCLOSURE_TEXT = "AI-generated content";
/** Total length of the appended tail (blur ramp + card hold), independent of the source clip's own duration. */
const TAIL_DURATION_SEC = 3.0;
/** How long the blur takes to ramp from 0 to full, at the start of the tail. */
const BLUR_RAMP_SEC = 0.5;
/** When the info card starts fading in, relative to the tail's own start — slightly before the blur ramp finishes so the two read as one continuous settle, not two separate beats. */
const CARD_FADE_START_SEC = 0.35;
const CARD_FADE_DURATION_SEC = 0.4;
const MAX_BLUR_SIGMA = 22;
/**
 * Canonical frame rate / audio sample rate for BOTH the trimmed segment and
 * the settle tail, so concatSegments's stream-copy concat is joining two
 * segments with identical codec parameters. Confirmed as a real bug
 * (2026-09-29): Veo returns 24fps/48kHz video+audio, but the tail was only
 * ever rendered at a hardcoded 30fps/44100Hz — concatenating the two via
 * `-c copy` without normalizing trimVideo's output to match produced a
 * corrupted container (audio track ~2s shorter than the video track, a
 * garbled non-integer avg_frame_rate, and total duration inflated well
 * beyond the sum of the two segments), which is what actually caused the
 * "freezes mid-sentence with a weirdly long tail" defect — not the
 * freeze-frame timestamp selection itself, which was already landing
 * correctly. Reproduced locally with a synthetic 24fps/48kHz clip before
 * this fix, confirmed gone after.
 */
const OUTPUT_FPS = 30;
const OUTPUT_SAMPLE_RATE = 44100;

export interface FinishClipInput {
  videoBase64: string;
  mimeType: string;
  nominalDurationSec: number;
  timingMode: TimingMode;
  /** Non-null only in hook_end_card delivery mode. */
  endCard: EndCardContent | null;
  /** Non-null only when ctaMode is "on_screen". */
  ctaOnScreenText: string | null;
}

function escapeDrawtext(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019");
}

/** `-ss` placed AFTER `-i` (not before) so this is a frame-accurate decode-to-timestamp seek, not a fast keyframe-snapped one — on a short clip the cost is negligible, and a keyframe-snapped seek can land noticeably earlier than the computed freeze time, capturing a visibly mid-word/mid-gesture frame instead of the settled one selectFreezeFrameTime chose. */
async function extractFramePng(srcPath: string, atSec: number, outPath: string): Promise<void> {
  await runFfmpeg(["-y", "-i", srcPath, "-ss", String(Math.max(0, atSec)), "-frames:v", "1", outPath]);
}

/** Explicitly normalizes to OUTPUT_FPS/OUTPUT_SAMPLE_RATE — see that constant's comment for why concatSegments requires both segments to already share these exactly. */
async function trimVideo(srcPath: string, endTimeSec: number, outPath: string): Promise<void> {
  await runFfmpeg([
    "-y",
    "-i", srcPath,
    "-t", String(endTimeSec),
    "-r", String(OUTPUT_FPS),
    "-c:v", "libx264",
    "-ar", String(OUTPUT_SAMPLE_RATE),
    "-c:a", "aac",
    "-pix_fmt", "yuv420p",
    outPath,
  ]);
}

/**
 * Builds the silent "settle" tail as its own short video: the frozen frame
 * holds, blurs progressively, and the info card fades in on top —
 * concatenated onto the trimmed video afterward. The blur ramp is built
 * from two STATIC stills (crisp and pre-blurred, both rendered once via
 * sharp) dissolved into each other with ffmpeg's xfade, rather than a
 * live per-frame blur expression: a real attempt at the latter (gblur's
 * `sigma` as a `min(t/0.5,1)`-style eval expression) hit an ffmpeg parser
 * error on a real test run ("Invalid chars... Unable to parse 'sigma'"),
 * and xfade between two known-good images is both simpler and something
 * ffmpeg is directly built to do well. Starting the dissolve at the crisp
 * still (identical to the trimmed video's own last frame) is what makes
 * the join with the trimmed clip invisible without a crossfade between
 * the two video segments themselves.
 */
async function buildSettleTail(framePngPath: string, blurredFramePngPath: string, cardPngPath: string, outPath: string): Promise<void> {
  await runFfmpeg([
    "-y",
    "-loop", "1", "-t", String(BLUR_RAMP_SEC + 0.2), "-i", framePngPath,
    "-loop", "1", "-t", String(TAIL_DURATION_SEC), "-i", blurredFramePngPath,
    "-loop", "1", "-t", String(TAIL_DURATION_SEC), "-i", cardPngPath,
    "-f", "lavfi", "-t", String(TAIL_DURATION_SEC), "-i", `anullsrc=channel_layout=stereo:sample_rate=${OUTPUT_SAMPLE_RATE}`,
    "-filter_complex",
    `[0:v]fps=${OUTPUT_FPS},scale=720:1280,format=yuv420p[crisp];` +
      `[1:v]fps=${OUTPUT_FPS},scale=720:1280,format=yuv420p[blurred];` +
      `[crisp][blurred]xfade=transition=fade:duration=${BLUR_RAMP_SEC}:offset=0,format=yuv420p[bg];` +
      `[2:v]fps=${OUTPUT_FPS},format=rgba,fade=t=in:st=${CARD_FADE_START_SEC}:d=${CARD_FADE_DURATION_SEC}:alpha=1[card];` +
      `[bg][card]overlay=0:0:format=auto,format=yuv420p[vout]`,
    "-map", "[vout]",
    "-map", "3:a",
    "-c:v", "libx264",
    "-ar", String(OUTPUT_SAMPLE_RATE),
    "-c:a", "aac",
    "-t", String(TAIL_DURATION_SEC),
    "-pix_fmt", "yuv420p",
    outPath,
  ]);
}

async function concatSegments(paths: string[], outPath: string): Promise<void> {
  const listPath = join(tmpdir(), `presenter-reel-concat-${randomUUID()}.txt`);
  const listContent = paths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  try {
    await writeFile(listPath, listContent, "utf8");
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);
  } finally {
    await unlink(listPath).catch(() => {});
  }
}

/** Appends the settled/blurred end card to the tail of a raw Veo clip. Returns null (never throws) if any stage fails — caller continues with the un-stitched clip rather than losing an otherwise-successful render. */
async function stitchEndCard(srcPath: string, nominalDurationSec: number, timingMode: TimingMode, endCard: EndCardContent): Promise<string | null> {
  const created: string[] = [];
  try {
    const freezeTime = await selectFreezeFrameTime(srcPath, timingMode, nominalDurationSec);

    const framePngPath = join(tmpdir(), `presenter-reel-frame-${randomUUID()}.png`);
    created.push(framePngPath);
    await extractFramePng(srcPath, freezeTime, framePngPath);

    const blurredFramePngPath = join(tmpdir(), `presenter-reel-frame-blurred-${randomUUID()}.png`);
    created.push(blurredFramePngPath);
    await sharp(framePngPath).blur(MAX_BLUR_SIGMA).toFile(blurredFramePngPath);

    const theme = await extractThemeColor(framePngPath);
    const cardPng = await renderEndCardPng(endCard, theme.accentHex, theme.isDarkBackground);
    const cardPngPath = join(tmpdir(), `presenter-reel-endcard-${randomUUID()}.png`);
    created.push(cardPngPath);
    await writeFile(cardPngPath, cardPng);

    const trimmedPath = join(tmpdir(), `presenter-reel-trimmed-${randomUUID()}.mp4`);
    created.push(trimmedPath);
    await trimVideo(srcPath, freezeTime, trimmedPath);

    const tailPath = join(tmpdir(), `presenter-reel-tail-${randomUUID()}.mp4`);
    created.push(tailPath);
    await buildSettleTail(framePngPath, blurredFramePngPath, cardPngPath, tailPath);

    const stitchedPath = join(tmpdir(), `presenter-reel-stitched-${randomUUID()}.mp4`);
    await concatSegments([trimmedPath, tailPath], stitchedPath);

    return stitchedPath;
  } catch (err) {
    console.error("[presenter-reel] end-card stitch failed — continuing without it:", err);
    return null;
  } finally {
    await Promise.all(created.map((p) => unlink(p).catch(() => {})));
  }
}

async function burnOverlays(srcPath: string, ctaOnScreenText: string | null): Promise<string> {
  const outPath = join(tmpdir(), `presenter-reel-labeled-${randomUUID()}.mp4`);
  const filters = [
    `drawtext=text='${escapeDrawtext(DISCLOSURE_TEXT)}':fontcolor=white:fontsize=26:x=20:y=h-50:box=1:boxcolor=black@0.5:boxborderw=10`,
  ];
  if (ctaOnScreenText) {
    filters.push(
      `drawtext=text='${escapeDrawtext(ctaOnScreenText)}':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=h-130:box=1:boxcolor=black@0.55:boxborderw=14`
    );
  }

  await runFfmpeg([
    "-y",
    "-i", srcPath,
    "-vf", filters.join(","),
    "-c:v", "libx264",
    "-c:a", "copy",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outPath,
  ]);

  return outPath;
}

/**
 * Returns the finished file's local path, or null if even the disclosure
 * pass failed on the raw (unstitched) source — the caller then falls back
 * to uploading the raw, unlabeled bytes rather than failing the job.
 */
export async function finishPresenterClip(input: FinishClipInput): Promise<string | null> {
  const created: string[] = [];
  const srcPath = join(tmpdir(), `presenter-reel-src-${randomUUID()}.mp4`);
  created.push(srcPath);
  await writeFile(srcPath, Buffer.from(input.videoBase64, "base64"));

  let currentPath = srcPath;
  if (input.endCard) {
    const stitched = await stitchEndCard(srcPath, input.nominalDurationSec, input.timingMode, input.endCard);
    if (stitched) {
      created.push(stitched);
      currentPath = stitched;
    }
  }

  let finalPath: string | null;
  try {
    finalPath = await burnOverlays(currentPath, input.ctaOnScreenText);
    created.push(finalPath);
  } catch (err) {
    console.error("[presenter-reel] disclosure/CTA overlay failed — uploading previous stage instead:", err);
    finalPath = currentPath === srcPath ? null : currentPath;
  }

  await Promise.all(created.filter((p) => p !== finalPath).map((p) => unlink(p).catch(() => {})));
  return finalPath;
}

/** Cleans up the finished output file after upload — caller's responsibility since it needs the path alive until then. */
export async function cleanupFinishedClip(path: string | null): Promise<void> {
  if (path) await unlink(path).catch(() => {});
}

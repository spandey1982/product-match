/**
 * Finishes a raw Veo presenter clip: optionally stitches a deterministic
 * end card onto the tail with a crossfade (hook_end_card delivery mode —
 * see end-card.ts and end-card-image.ts), then always burns in the
 * AI-disclosure label and, when requested, an on-screen CTA — both via
 * ffmpeg drawtext, in one pass so the video is only re-encoded once for
 * those two overlays. Supersedes the narrower disclosure-overlay.ts (folded
 * in here, since disclosure now needs to apply AFTER any end-card stitch,
 * covering the whole final video, not just the raw Veo output).
 *
 * Same defensive philosophy throughout as the code it replaces (see
 * lib/catalogue-motion/workers/compose.ts's own end-card comment): every
 * step is attempted, and a failure degrades to the previous good stage
 * rather than failing the whole render. The one exception is losing the
 * disclosure label entirely — that's a compliance gap, not missed polish,
 * so it's logged loudly (console.error) rather than silently swallowed.
 */
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runFfmpeg, probeVideo } from "@/lib/catalogue-motion/ffmpeg";
import { renderEndCardPng } from "./end-card-image";
import type { EndCardContent } from "./end-card";

const DISCLOSURE_TEXT = "AI-generated content";
/** How long the end card holds on screen after the crossfade completes. */
const END_CARD_HOLD_SEC = 2.5;
const TRANSITION_SEC = 0.5;

export interface FinishClipInput {
  videoBase64: string;
  mimeType: string;
  /** Non-null only in hook_end_card delivery mode. */
  endCard: EndCardContent | null;
  /** Non-null only when ctaMode is "on_screen". */
  ctaOnScreenText: string | null;
}

function escapeDrawtext(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019");
}

/** Appends a held static end-card image to the tail of a clip with a short crossfade, so the join reads as the video settling on its last frame rather than a hard cut. */
async function stitchEndCard(srcPath: string, endCard: EndCardContent): Promise<string> {
  const cardPngPath = join(tmpdir(), `presenter-reel-card-${randomUUID()}.png`);
  const outPath = join(tmpdir(), `presenter-reel-stitched-${randomUUID()}.mp4`);
  try {
    await writeFile(cardPngPath, await renderEndCardPng(endCard));

    const probe = await probeVideo(srcPath);
    const veoDuration = probe.durationSec > 0 ? probe.durationSec : 8;
    const offset = Math.max(0.1, veoDuration - TRANSITION_SEC);
    const cardSegmentDuration = END_CARD_HOLD_SEC + TRANSITION_SEC;

    // xfade requires both input streams to share a frame rate/timebase — the
    // real Veo clip (variable-ish timebase from its own encode) and a
    // -loop 1 still image (defaults to 25fps) don't match without an
    // explicit `fps` filter on both branches first. Found via a real local
    // test (reused an already-paid-for existing clip, no new Veo cost):
    // omitting this fails with "First input link main timebase... do not
    // match the corresponding second input link xfade timebase" and the
    // whole stitch silently falls back to the unstitched clip.
    const fps = 30;
    await runFfmpeg([
      "-y",
      "-i", srcPath,
      "-loop", "1", "-r", String(fps), "-t", String(cardSegmentDuration), "-i", cardPngPath,
      "-filter_complex",
      `[0:v]fps=${fps},format=yuv420p[main];[1:v]scale=720:1280,fps=${fps},format=yuv420p[card];[main][card]xfade=transition=fade:duration=${TRANSITION_SEC}:offset=${offset.toFixed(2)}[vout]`,
      "-map", "[vout]",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outPath,
    ]);

    return outPath;
  } finally {
    await unlink(cardPngPath).catch(() => {});
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
    try {
      const stitched = await stitchEndCard(currentPath, input.endCard);
      created.push(stitched);
      currentPath = stitched;
    } catch (err) {
      console.error("[presenter-reel] end-card stitch failed — continuing without it:", err);
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

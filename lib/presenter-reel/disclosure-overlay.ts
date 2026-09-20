/**
 * Burns a persistent "AI-generated content" label into a presenter-reel
 * clip's pixels — not just UI chrome on our own review screen. This
 * matters specifically because a marketing video is meant to be
 * downloaded and reposted elsewhere (Instagram, WhatsApp, a retailer's own
 * site) where our UI never travels with it. The reference reel this whole
 * feature was reverse-engineered from (research/
 * ai-presenter-reel-reverse-engineering.html) showed Meesho's own platform
 * displaying an "AI content" disclosure directly in their app chrome around
 * the video — we don't control Instagram's chrome the way Meesho controls
 * their own, so the label has to travel inside the file itself.
 *
 * Same defensive philosophy as lib/catalogue-motion/workers/compose.ts's
 * store-name end-card: attempted, never blocks the job. A missing font in
 * a minimal container shouldn't fail an otherwise-successful render over a
 * cosmetic-looking text overlay — though unlike a branding end-card, a
 * silent disclosure failure is a real compliance gap, not just missed
 * polish, so it's logged loudly (console.error, not a quiet catch) rather
 * than swallowed the same way.
 */
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runFfmpeg } from "@/lib/catalogue-motion/ffmpeg";

const DISCLOSURE_TEXT = "AI-generated content";

/**
 * Writes videoBase64 to a temp file, burns the disclosure label in via
 * ffmpeg drawtext (persistent for the whole clip, not just an end card —
 * unlike compose.ts's branding card, this needs to be visible throughout
 * since a viewer could join or screenshot at any point), and returns the
 * labeled file's local path for the caller to upload directly. Returns
 * null on any ffmpeg failure — the caller falls back to uploading the
 * original, unlabeled bytes rather than failing the whole render.
 */
export async function applyDisclosureOverlay(videoBase64: string, mimeType: string): Promise<string | null> {
  const ext = mimeType.includes("mp4") ? "mp4" : "mp4";
  const srcPath = join(tmpdir(), `presenter-reel-src-${randomUUID()}.${ext}`);
  const outPath = join(tmpdir(), `presenter-reel-disclosed-${randomUUID()}.mp4`);

  try {
    await writeFile(srcPath, Buffer.from(videoBase64, "base64"));

    await runFfmpeg([
      "-y",
      "-i", srcPath,
      "-vf", `drawtext=text='${DISCLOSURE_TEXT}':fontcolor=white:fontsize=26:x=20:y=h-50:box=1:boxcolor=black@0.5:boxborderw=10`,
      "-c:v", "libx264",
      "-c:a", "copy",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath,
    ]);

    return outPath;
  } catch (err) {
    console.error("[presenter-reel] disclosure overlay failed — uploading unlabeled video instead:", err);
    return null;
  } finally {
    await unlink(srcPath).catch(() => {});
  }
}

/** Cleans up the labeled output file after upload — caller's responsibility since it needs the path alive until then. */
export async function cleanupDisclosureOutput(path: string): Promise<void> {
  await unlink(path).catch(() => {});
}

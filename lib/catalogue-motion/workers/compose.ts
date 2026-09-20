/**
 * motion.compose job handler — assembles a job's accepted clips into one
 * final video.
 *
 * Trims each accepted clip to its director-planned holdDurationSec (see
 * MotionClip.plannedHoldSec) FROM THE START of the generated clip, then
 * concatenates in the director's planned shot order (hook first) — this is
 * the actual mechanism that makes pacing non-uniform: every clip still
 * generates at Veo's fixed 4/6/8s floor, but the final on-screen length is
 * whatever the director decided, achieved entirely by trimming here.
 *
 * A static branded end card (the retailer's store name, text-overlaid on
 * the last 1.5s) is attempted but never blocks the compose — if drawtext
 * fails for any reason (e.g. a minimal container with no fonts installed),
 * the job still completes with the plain concatenated video rather than
 * failing outright over cosmetic polish.
 *
 * No music/voiceover in this pass (see research/beyond-the-clip.html's
 * "genuinely undecided" flag on the vendor choice — a new paid dependency,
 * out of scope here) and no audio track at all (Veo generation itself is
 * silent by design, generateAudio: false in veo-provider.ts).
 */
import { randomUUID } from "crypto";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { db } from "@/lib/db";
import { uploadWithRetry } from "@/lib/cloudinary";
import { runFfmpeg } from "../ffmpeg";
import { sampleClipColors, checkColorConsistency } from "../color-consistency";
import type { MotionComposePayload } from "@/lib/queue/types";
import type { DirectorPlan } from "../types";

interface OrderedClip {
  view: string;
  outputUrl: string;
  plannedHoldSec: number;
  renderMode: string;
}

function buildFilterGraph(clips: OrderedClip[], storeName: string | null, totalDuration: number): { filter: string; outLabel: string } {
  const parts: string[] = [];
  clips.forEach((c, i) => {
    // setsar=1 defensively normalizes sample aspect ratio across every
    // input regardless of which renderer produced it — concat requires an
    // EXACT SAR match between clips, and different render paths (or even
    // different runs of the same one) can produce very-slightly-non-1:1 SAR
    // as a scale-filter rounding artifact, which fails concat outright with
    // no useful error otherwise (confirmed live against the pan-zoom path).
    parts.push(`[${i}:v]trim=duration=${c.plannedHoldSec},setpts=PTS-STARTPTS,setsar=1[v${i}]`);
  });
  const concatInputs = clips.map((_, i) => `[v${i}]`).join("");
  parts.push(`${concatInputs}concat=n=${clips.length}:v=1:a=0[concatv]`);

  if (!storeName) return { filter: parts.join(";"), outLabel: "concatv" };

  const escaped = storeName.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
  const startT = Math.max(0, totalDuration - 1.5);
  parts.push(
    `[concatv]drawtext=text='${escaped}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-120:box=1:boxcolor=black@0.45:boxborderw=16:enable='between(t\\,${startT}\\,${totalDuration})'[outv]`
  );
  return { filter: parts.join(";"), outLabel: "outv" };
}

async function renderToFile(outputPath: string, clips: OrderedClip[], storeName: string | null, totalDuration: number): Promise<void> {
  const { filter, outLabel } = buildFilterGraph(clips, storeName, totalDuration);
  const args: string[] = ["-y"];
  for (const c of clips) args.push("-i", c.outputUrl);
  args.push(
    "-filter_complex", filter,
    "-map", `[${outLabel}]`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    outputPath
  );
  await runFfmpeg(args);
}

export async function handleMotionCompose(payload: MotionComposePayload): Promise<void> {
  const job = await db.motionJob.findUnique({
    where: { id: payload.jobId },
    include: { clips: true, user: { select: { storeName: true } } },
  });
  if (!job) return;

  const acceptedClips = job.clips.filter((c) => c.status === "accepted" && c.outputUrl);

  let orderedClips: OrderedClip[];
  if (job.deliverable === "reel") {
    // Reel jobs never populate directorPlan (see orchestrator.ts's
    // startReelMotionJob — the hook/interaction/detail/close order is fixed
    // by the playbook, not planned) — shotIndex, set at clip-creation time
    // in that same fixed order, is the reel equivalent of directorPlan's
    // shot ordering.
    orderedClips = acceptedClips
      .sort((a, b) => a.shotIndex - b.shotIndex)
      .map((c) => ({ view: c.view, outputUrl: c.outputUrl!, plannedHoldSec: c.plannedHoldSec ?? 4, renderMode: c.renderMode }));
  } else {
    const plan = job.directorPlan ? (JSON.parse(job.directorPlan) as DirectorPlan) : null;
    if (!plan) {
      await db.motionJob.update({ where: { id: payload.jobId }, data: { status: "failed", errorMessage: "No director plan to compose from" } });
      return;
    }
    const acceptedByView = new Map(acceptedClips.map((c) => [c.view, c]));
    orderedClips = plan.shots
      .map((s) => acceptedByView.get(s.view))
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map((c) => ({ view: c.view, outputUrl: c.outputUrl!, plannedHoldSec: c.plannedHoldSec ?? 4, renderMode: c.renderMode }));
  }

  if (orderedClips.length === 0) {
    await db.motionJob.update({
      where: { id: payload.jobId },
      data: { status: "failed", errorMessage: "No accepted clips to compose" },
    });
    return;
  }

  await db.motionJob.update({ where: { id: payload.jobId }, data: { status: "composing" } });

  const totalDuration = orderedClips.reduce((sum, c) => sum + c.plannedHoldSec, 0);
  const outputPath = join(tmpdir(), `motion-compose-${randomUUID()}.mp4`);
  const storeName = job.user.storeName?.trim() || null;

  try {
    try {
      await renderToFile(outputPath, orderedClips, storeName, totalDuration);
    } catch (endCardErr) {
      if (storeName) {
        // End-card overlay failed (e.g. no fonts in a minimal container) —
        // retry without it rather than failing the whole compose over
        // cosmetic polish.
        console.error("[compose] end-card render failed, retrying without it:", endCardErr);
        await renderToFile(outputPath, orderedClips, null, totalDuration);
      } else {
        throw endCardErr;
      }
    }

    const fileBuffer = await readFile(outputPath);
    const dataUri = `data:video/mp4;base64,${fileBuffer.toString("base64")}`;
    const upload = await uploadWithRetry(dataUri, {
      folder: "product-match/catalogue-motion",
      resource_type: "video",
    });

    // Advisory only, best-effort — a sampling failure (or the check simply
    // finding nothing to flag) must never affect a compose that already
    // succeeded. See color-consistency.ts's header for why the threshold is
    // an unvalidated first pass, not a hard gate.
    //
    // ai-motion clips only: a pan-zoom detail crop (e.g. blouse/pallu) is
    // DELIBERATELY framed tight on fabric alone, with little to no skin tone
    // or background in frame — its average color is expected to differ a
    // lot from a full-body worn shot regardless of grading consistency.
    // Live-tested finding (2026-09-06): the very first real run of this
    // check flagged exactly that comparison (a fabric-only crop vs. a
    // full-body shot) as "drift," when the three actual worn-garment shots
    // were well within threshold of each other — comparing a detail crop
    // was measuring framing, not tone.
    let colorConsistencyNote: string | null = null;
    const wornShotClips = orderedClips.filter((c) => c.renderMode === "ai-motion");
    if (wornShotClips.length > 1) {
      try {
        const samples = await sampleClipColors(wornShotClips);
        colorConsistencyNote = checkColorConsistency(samples).note;
      } catch (colorErr) {
        console.error("[compose] color-consistency check failed (non-fatal):", colorErr);
      }
    }

    await db.motionJob.update({
      where: { id: payload.jobId },
      data: {
        status: "complete",
        outputUrl: upload.secure_url,
        duration: Math.round(totalDuration),
        errorMessage: null, // clear any stale message from an earlier failed compose attempt on this job
        colorConsistencyNote,
      },
    });
  } catch (err) {
    await db.motionJob.update({
      where: { id: payload.jobId },
      data: { status: "failed", errorMessage: err instanceof Error ? err.message.slice(0, 500) : String(err) },
    });
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}

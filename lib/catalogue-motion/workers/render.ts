/**
 * motion.render job handler — renders ONE storyboard shot via the active
 * MotionProvider (Veo) and enqueues motion.qa on success.
 *
 * Pure handler function, no pg-boss import here — worker/index.ts adapts
 * pg-boss v12's batch-array `.work()` calling convention into per-job calls
 * against this function, so it stays unit-testable on its own.
 */
import { db } from "@/lib/db";
import { getBoss } from "@/lib/queue/boss";
import { QUEUES, type MotionRenderPayload, type MotionQAPayload } from "@/lib/queue/types";
import { resolvePreset } from "../grammar";
import { constraintsFor, isMotionIntensity, DEFAULT_INTENSITY } from "../constraints";
import { buildClipInstruction } from "../prompt-builder";
import { buildReelClipInstruction } from "../reel/reel-prompt-builder";
import { isReelPresentation } from "../reel/reel-types";
import { getMotionProvider } from "../provider";
import { nearestVeoDuration } from "../provider/veo-provider";
import { renderPanZoomClip } from "../pan-zoom-renderer";
import { uploadWithRetry } from "@/lib/cloudinary";
import { chargeForCall, refundCharge } from "@/lib/billing/charge";
import { maybeAdvanceToQA } from "../orchestrator";

const MAX_RENDER_RETRIES = 2; // matches QUEUE_OPTIONS[MOTION_RENDER].retryLimit
// Reel ai-motion shots get a lower ceiling: the first live test found QA
// rejections on this deliverable are often a systematic, category-level
// fidelity ceiling (dense embroidery + camera movement), not transient bad
// luck — retrying identical params 2-3x at full Veo price just re-confirms
// the same failure. See research/reel-engine-components.html's economics section.
const MAX_RENDER_RETRIES_REEL = 1;

export async function handleMotionRender(payload: MotionRenderPayload): Promise<void> {
  const preset = resolvePreset(payload.presetId);
  if (!preset) {
    await failClip(payload.clipId, `Unknown preset "${payload.presetId}"`);
    return;
  }
  const intensity = isMotionIntensity(payload.intensity) ? payload.intensity : DEFAULT_INTENSITY;
  const job = await db.motionJob.findUnique({ where: { id: payload.jobId }, select: { userId: true } });
  if (!job) {
    await failClip(payload.clipId, `Motion job ${payload.jobId} not found`);
    return;
  }

  // Pre-flight credit gate, same shape as every other paid AI call in this
  // app (see lib/model-gen/engine.ts). Retail pricing for "motion_clip" is
  // still unset (a deferred business decision) — chargeForCall degrades to a
  // no-op $0 charge in that case, so this is safe to wire in now rather than
  // leaving Veo spend completely ungated until pricing is decided later.
  const charge = await chargeForCall(job.userId, "motion_clip");
  if ("insufficientCredits" in charge) {
    await failClip(payload.clipId, "insufficient_credits");
    return;
  }

  await db.motionClip.update({ where: { id: payload.clipId }, data: { status: "rendering" } });

  try {
    const constraints = constraintsFor(intensity);

    let videoBase64: string;
    let mimeType: string;
    let durationMs: number;
    let costUsd: number | null;

    if (payload.renderMode === "pan-zoom") {
      // Local deterministic FFmpeg Ken Burns — zero AI cost, zero
      // hallucination risk, renders at the exact planned duration (no Veo
      // floor-then-trim dance needed).
      const result = await renderPanZoomClip({
        sourceImageUrl: payload.sourceImageUrl,
        preset,
        constraints,
        durationSec: payload.durationSec,
      });
      videoBase64 = result.videoBuffer.toString("base64");
      mimeType = "video/mp4";
      durationMs = result.durationMs;
      costUsd = 0;
    } else {
      const genDurationSec = nearestVeoDuration(payload.durationSec);
      const isReel = payload.deliverable === "reel";
      if (isReel && !isReelPresentation(payload.presentation)) {
        await failClip(payload.clipId, `Reel clip missing a valid presentation ("model"/"mannequin")`);
        return;
      }
      const instruction = isReel
        ? buildReelClipInstruction(
            preset,
            intensity,
            constraints,
            genDurationSec,
            payload.presentation!,
            payload.engagementCue ?? "",
            payload.lightingDescriptor || "soft, even studio lighting flattering to both fabric and skin tone",
            payload.isDetailTruth,
          )
        : buildClipInstruction(preset, intensity, constraints, genDurationSec, payload.motionEmphasis);

      const provider = getMotionProvider();
      const result = await provider.generateClip({
        sourceImageUrl: payload.sourceImageUrl,
        instruction,
        intensity,
        constraints,
        durationSec: genDurationSec,
        cropRegion: payload.cropRegion,
        usage: { feature: isReel ? "catalogue_motion_reel" : "catalogue_motion", userId: job.userId, storeId: job.userId },
      });
      videoBase64 = result.videoBase64;
      mimeType = result.mimeType;
      durationMs = result.durationMs;
      costUsd = result.costUsd;
    }

    const dataUri = `data:${mimeType};base64,${videoBase64}`;
    const upload = await uploadWithRetry(dataUri, {
      folder: "product-match/catalogue-motion",
      resource_type: "video",
    });

    await db.motionClip.update({
      where: { id: payload.clipId },
      data: {
        status: "qa",
        outputUrl: upload.secure_url,
        durationMs,
        costUsd,
      },
    });

    const boss = await getBoss();
    const qaPayload: MotionQAPayload = {
      clipId: payload.clipId,
      jobId: payload.jobId,
      clipUrl: upload.secure_url,
      sourceImageUrl: payload.sourceImageUrl,
      renderMode: payload.renderMode,
      deliverable: payload.deliverable,
    };
    await boss.send(QUEUES.MOTION_QA, qaPayload);
    await maybeAdvanceToQA(payload.jobId);
  } catch (err) {
    // Every failed attempt refunds its own charge — a retried job re-runs
    // chargeForCall from the top on redelivery, so each attempt is charged
    // and (on failure) refunded independently, never left double-charged.
    if (charge.priceUsd > 0) {
      await refundCharge(job.userId, charge.priceUsd, `Refund: motion_clip render failed (clip ${payload.clipId})`);
    }
    await failOrRetry(payload, err);
  }
}

async function failClip(clipId: string, message: string): Promise<void> {
  await db.motionClip.update({ where: { id: clipId }, data: { status: "failed", errorMessage: message.slice(0, 500) } });
}

async function failOrRetry(payload: MotionRenderPayload, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const clip = await db.motionClip.update({
    where: { id: payload.clipId },
    data: { retryCount: { increment: 1 } },
    select: { retryCount: true },
  });
  const ceiling = payload.deliverable === "reel" ? MAX_RENDER_RETRIES_REEL : MAX_RENDER_RETRIES;
  if (clip.retryCount > ceiling) {
    await db.motionClip.update({ where: { id: payload.clipId }, data: { status: "failed", errorMessage: message.slice(0, 500) } });
    return;
  }
  // Let pg-boss's own queue-level retry (QUEUE_OPTIONS[MOTION_RENDER]) handle
  // re-delivery — rethrow so the job is marked failed and retried by pg-boss
  // itself rather than manually re-enqueued here.
  await db.motionClip.update({ where: { id: payload.clipId }, data: { status: "queued", errorMessage: message.slice(0, 500) } });
  throw err;
}

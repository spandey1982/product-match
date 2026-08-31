/**
 * Catalogue Motion orchestrator — creates and starts a MotionJob.
 *
 * `createMotionJob` + `startMotionJob` are deliberately separate (mirrors a
 * normal create-then-start REST shape): creating a job is instant and cheap
 * (one DB row); starting one runs the director agent and fans out real
 * render work, so a caller can create a job and let the retailer trigger it
 * explicitly rather than always starting immediately.
 *
 * `startMotionJob` does NOT await rendering — it resolves the plan, creates
 * MotionClip rows, enqueues one `motion.render` pg-boss job per shot, and
 * returns. The actual Veo calls happen in the render worker
 * (workers/render.ts), out-of-process, because a single clip's generation
 * can take up to ~2 minutes (veo-provider.ts's poll ceiling) — too long to
 * hold open inside a request that's also serving retailer traffic.
 */
import { db } from "@/lib/db";
import { getBoss } from "@/lib/queue/boss";
import { QUEUES, type MotionRenderPayload } from "@/lib/queue/types";
import { storyboardFor } from "./storyboards";
import { resolveShotSources } from "./source-resolver";
import { directorAgent } from "./agents/directorAgent";
import { DEFAULT_INTENSITY, isMotionIntensity } from "./constraints";
import { DEFAULT_MOTION_PROVIDER_ID, type MotionProviderId } from "./provider";
import type { DirectorPlan, MotionIntensity } from "./types";

export interface CreateMotionJobInput {
  productId: string;
  userId: string;
  intensity?: MotionIntensity;
  provider?: MotionProviderId;
}

export async function createMotionJob(input: CreateMotionJobInput): Promise<{ id: string }> {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { category: true },
  });
  if (!product) throw new Error(`Product ${input.productId} not found`);

  const intensity = input.intensity && isMotionIntensity(input.intensity) ? input.intensity : DEFAULT_INTENSITY;
  const storyboard = storyboardFor(product.category);

  const job = await db.motionJob.create({
    data: {
      productId: input.productId,
      userId: input.userId,
      intensity,
      storyboardId: storyboard.categoryKey,
      provider: input.provider ?? DEFAULT_MOTION_PROVIDER_ID,
      status: "queued",
    },
    select: { id: true },
  });
  return job;
}

/**
 * Idempotent: a job that already has clips is treated as already started
 * (matches lib/fashion-designer/pipeline.ts's per-stage checkpoint
 * convention — safe to call again on a resumed/retried job).
 */
export async function startMotionJob(jobId: string): Promise<void> {
  const job = await db.motionJob.findUnique({
    where: { id: jobId },
    include: { clips: { select: { id: true } } },
  });
  if (!job) throw new Error(`Motion job ${jobId} not found`);
  if (job.clips.length > 0) return;

  const product = await db.product.findUnique({
    where: { id: job.productId },
    select: { category: true, color: true, detailNotes: true, imageUrl: true, backImageUrl: true },
  });
  if (!product) {
    await db.motionJob.update({ where: { id: jobId }, data: { status: "failed", errorMessage: "Product not found" } });
    return;
  }

  const storyboard = storyboardFor(product.category);

  let plan: DirectorPlan;
  if (job.directorPlan) {
    plan = JSON.parse(job.directorPlan) as DirectorPlan;
  } else {
    plan = await directorAgent({
      category: product.category,
      color: product.color,
      detailNotes: product.detailNotes,
      usage: { feature: "catalogue_motion", storeId: job.userId, userId: job.userId },
    });
    await db.motionJob.update({ where: { id: jobId }, data: { directorPlan: JSON.stringify(plan) } });
  }

  const planShotsToResolve = storyboard.shots.filter((s) => plan.shots.some((p) => p.view === s.view));
  const resolved = resolveShotSources(product.category, planShotsToResolve, {
    front: product.imageUrl ?? undefined,
    back: product.backImageUrl ?? undefined,
  });
  const resolvedByView = new Map(resolved.map((r) => [r.shot.view, r]));

  const clipsToCreate = plan.shots
    .map((planShot, index) => {
      const source = resolvedByView.get(planShot.view);
      if (!source) return null; // base image missing for this shot's sourceBase — graceful degrade, matches resolveShotSources' own convention
      return {
        jobId,
        shotIndex: index,
        view: planShot.view,
        presetId: planShot.presetId,
        sourceImageUrl: source.imageUrl,
        plannedHoldSec: planShot.holdDurationSec,
        status: "queued" as const,
        cropRegion: source.cropRegion,
        motionEmphasis: planShot.motionEmphasis,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (clipsToCreate.length === 0) {
    await db.motionJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: "No shot sources could be resolved (missing base catalogue images)" },
    });
    return;
  }

  const createdClips = await db.$transaction(
    clipsToCreate.map((c) =>
      db.motionClip.create({
        data: {
          jobId: c.jobId,
          shotIndex: c.shotIndex,
          view: c.view,
          presetId: c.presetId,
          sourceImageUrl: c.sourceImageUrl,
          plannedHoldSec: c.plannedHoldSec,
          status: c.status,
        },
      })
    )
  );

  await db.motionJob.update({ where: { id: jobId }, data: { status: "rendering" } });

  const boss = await getBoss();
  for (const clip of createdClips) {
    const source = clipsToCreate.find((c) => c.view === clip.view)!;
    const payload: MotionRenderPayload = {
      clipId: clip.id,
      jobId,
      sourceImageUrl: clip.sourceImageUrl,
      presetId: clip.presetId,
      motionEmphasis: source.motionEmphasis,
      intensity: job.intensity,
      durationSec: clip.plannedHoldSec ?? 4,
      cropRegion: source.cropRegion,
    };
    await boss.send(QUEUES.MOTION_RENDER, payload);
  }
}

/**
 * Re-enqueues motion.render for one existing clip — used by the QA worker
 * when a clip is rejected (see workers/qa.ts). Regenerates at the SAME
 * plan (same preset, hold duration, motionEmphasis pulled back out of the
 * job's persisted directorPlan) — a QA-driven regeneration attempt-retries
 * the director's decision, it never re-plans (see directorAgent.ts's header
 * comment on why creative direction and generation retry stay decoupled).
 */
export async function enqueueRenderForClip(clipId: string): Promise<void> {
  const clip = await db.motionClip.findUniqueOrThrow({ where: { id: clipId } });
  const job = await db.motionJob.findUniqueOrThrow({ where: { id: clip.jobId } });
  const plan = job.directorPlan ? (JSON.parse(job.directorPlan) as DirectorPlan) : null;
  const planShot = plan?.shots.find((s) => s.view === clip.view);

  const payload: MotionRenderPayload = {
    clipId: clip.id,
    jobId: clip.jobId,
    sourceImageUrl: clip.sourceImageUrl,
    presetId: clip.presetId,
    motionEmphasis: planShot?.motionEmphasis,
    intensity: job.intensity,
    durationSec: clip.plannedHoldSec ?? 4,
  };

  await db.motionClip.update({ where: { id: clipId }, data: { status: "queued" } });
  const boss = await getBoss();
  await boss.send(QUEUES.MOTION_RENDER, payload);
}

/**
 * Checks whether every clip in a job has reached a terminal state
 * (accepted/rejected/failed — never queued/rendering/qa) and, if so,
 * either enqueues motion.compose (at least one accepted clip) or fails the
 * job outright (none did). Called from the QA worker after every verdict
 * and from the manual-review admin action — cheap to call speculatively
 * since it no-ops unless the job is actually fully resolved.
 */
export async function maybeAdvanceToCompose(jobId: string): Promise<void> {
  const job = await db.motionJob.findUnique({ where: { id: jobId }, include: { clips: true } });
  if (!job || job.status === "composing" || job.status === "complete") return;

  const unresolved = job.clips.some((c) => !["accepted", "rejected", "failed"].includes(c.status));
  if (unresolved) return;

  const acceptedCount = job.clips.filter((c) => c.status === "accepted").length;
  if (acceptedCount === 0) {
    await db.motionJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: "No clips were accepted by QA" },
    });
    return;
  }

  const boss = await getBoss();
  await boss.send(QUEUES.MOTION_COMPOSE, {
    jobId,
    clipIds: job.clips.filter((c) => c.status === "accepted").map((c) => c.id),
    outputFormat: "website",
    duration: 0,
  });
}

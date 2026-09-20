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
import { reelStoryboardFor } from "./reel/reel-storyboards";
import { resolveReelShotSources } from "./reel/reference-resolver";
import { lightingDescriptorFor } from "./reel/lighting";
import { assessPatternRisk } from "./reel/pattern-risk";
import { DEFAULT_REEL_ARCHETYPE, isMotionDeliverable, isReelPresentation, type ReelPresentation } from "./reel/reel-types";
import type { DirectorPlan, MotionIntensity, MotionDeliverable, ReelArchetype } from "./types";

export interface CreateMotionJobInput {
  productId: string;
  userId: string;
  intensity?: MotionIntensity;
  provider?: MotionProviderId;
  deliverable?: MotionDeliverable;
  /** Required (validated by the API route) when deliverable is "reel". */
  presentation?: ReelPresentation;
  archetype?: ReelArchetype;
}

export async function createMotionJob(input: CreateMotionJobInput): Promise<{ id: string }> {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { category: true },
  });
  if (!product) throw new Error(`Product ${input.productId} not found`);

  const intensity = input.intensity && isMotionIntensity(input.intensity) ? input.intensity : DEFAULT_INTENSITY;
  const deliverable: MotionDeliverable = isMotionDeliverable(input.deliverable) ? input.deliverable : "catalogue";
  const isReel = deliverable === "reel";
  if (isReel && !isReelPresentation(input.presentation)) {
    throw new Error(`A reel job requires a valid presentation ("model" or "mannequin")`);
  }
  const storyboardId = isReel ? reelStoryboardFor(product.category).categoryKey : storyboardFor(product.category).categoryKey;

  const job = await db.motionJob.create({
    data: {
      productId: input.productId,
      userId: input.userId,
      intensity,
      storyboardId,
      provider: input.provider ?? DEFAULT_MOTION_PROVIDER_ID,
      status: "queued",
      deliverable,
      archetype: isReel ? input.archetype ?? DEFAULT_REEL_ARCHETYPE : null,
      presentation: isReel && isReelPresentation(input.presentation) ? input.presentation : null,
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
    select: { category: true, color: true, detailNotes: true, imageUrl: true, backImageUrl: true, material: true, pattern: true },
  });
  if (!product) {
    await db.motionJob.update({ where: { id: jobId }, data: { status: "failed", errorMessage: "Product not found" } });
    return;
  }

  if (job.deliverable === "reel") {
    await startReelMotionJob(jobId, job.productId, job.intensity, job.presentation, product);
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
        renderMode: source.shot.renderMode,
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
          renderMode: c.renderMode,
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
      renderMode: clip.renderMode as "ai-motion" | "pan-zoom",
      motionEmphasis: source.motionEmphasis,
      intensity: job.intensity,
      durationSec: clip.plannedHoldSec ?? 4,
      cropRegion: source.cropRegion,
    };
    await boss.send(QUEUES.MOTION_RENDER, payload);
  }
}

/**
 * Reel counterpart to the catalogue path above. No director-agent call: the
 * hook → interaction → detail → close structure is authoritative per
 * reel-playbook.ts, not chosen per-product, so there's nothing for an LLM to
 * plan — reel-storyboards.ts's fixed shot list IS the plan. Everything else
 * (clip creation, queueing) mirrors the catalogue path above.
 */
async function startReelMotionJob(
  jobId: string,
  productId: string,
  intensity: string,
  presentationRaw: string | null,
  product: { category: string; imageUrl: string | null; backImageUrl: string | null; material?: string | null; pattern?: string | null },
): Promise<void> {
  if (!isReelPresentation(presentationRaw)) {
    await db.motionJob.update({ where: { id: jobId }, data: { status: "failed", errorMessage: "Reel job missing a valid presentation" } });
    return;
  }
  const presentation = presentationRaw;
  const lightingDescriptor = lightingDescriptorFor(product.material, product.pattern);

  // Real, vision-extracted embellishment density (Garment Intelligence) —
  // Product.pattern's coarse text can't distinguish a simple scattered motif
  // from dense all-over mirror-work (confirmed live, 2026-09-06: both get
  // tagged "Embroidered"). GI-gated on purpose: no GI row means no
  // assessment, not a guess from the unreliable field.
  const gi = await db.garmentIntelligence.findUnique({ where: { productId }, select: { data: true } });
  const patternRisk = assessPatternRisk(gi?.data ?? null);
  const effectiveIntensity = patternRisk.highRisk ? "minimal" : intensity;

  const storyboard = reelStoryboardFor(product.category, { material: product.material, pattern: product.pattern });
  const { resolved, skippedSourceNote } = await resolveReelShotSources(productId, product.category, presentation, storyboard.shots, {
    front: product.imageUrl ?? undefined,
    back: product.backImageUrl ?? undefined,
  });

  if (resolved.length === 0) {
    await db.motionJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage:
          skippedSourceNote ??
          "No shot sources could be resolved (missing base catalogue images)",
      },
    });
    return;
  }

  const createdClips = await db.$transaction(
    resolved.map((r, index) =>
      db.motionClip.create({
        data: {
          jobId,
          shotIndex: index,
          view: r.shot.view,
          presetId: r.shot.presetId,
          sourceImageUrl: r.imageUrl,
          plannedHoldSec: r.shot.durationSec,
          status: "queued",
          renderMode: r.shot.renderMode,
        },
      })
    )
  );

  // intensity is persisted here (not just used locally) so a later retry —
  // enqueueRenderForClip reads job.intensity fresh from the DB — stays
  // consistent with whatever was actually decided for this job, rather than
  // silently reverting to the originally-requested value on retry.
  await db.motionJob.update({
    where: { id: jobId },
    data: {
      status: "rendering",
      intensity: effectiveIntensity,
      patternRiskNote: patternRisk.note,
      sourceGapNote: skippedSourceNote,
    },
  });

  const boss = await getBoss();
  for (let i = 0; i < createdClips.length; i++) {
    const clip = createdClips[i];
    const shot = resolved[i].shot;
    const payload: MotionRenderPayload = {
      clipId: clip.id,
      jobId,
      sourceImageUrl: clip.sourceImageUrl,
      presetId: clip.presetId,
      renderMode: clip.renderMode as "ai-motion" | "pan-zoom",
      intensity: effectiveIntensity,
      durationSec: clip.plannedHoldSec ?? 4,
      cropRegion: resolved[i].cropRegion,
      deliverable: "reel",
      presentation,
      engagementCue: shot.engagementCue,
      lightingDescriptor,
      isDetailTruth: shot.isDetailTruth,
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

  const payload: MotionRenderPayload = {
    clipId: clip.id,
    jobId: clip.jobId,
    sourceImageUrl: clip.sourceImageUrl,
    presetId: clip.presetId,
    renderMode: clip.renderMode as "ai-motion" | "pan-zoom",
    intensity: job.intensity,
    durationSec: clip.plannedHoldSec ?? 4,
  };

  if (job.deliverable === "reel") {
    // Regeneration attempt-retries the SAME shot — re-derive its
    // engagementCue from the fixed reel storyboard by matching clip.view,
    // the reel equivalent of pulling motionEmphasis back out of directorPlan
    // below (reel has no directorPlan — its structure is fixed, not planned).
    const product = await db.product.findUnique({ where: { id: job.productId }, select: { category: true, material: true, pattern: true } });
    const shot = reelStoryboardFor(product?.category ?? null).shots.find((s) => s.view === clip.view);
    payload.deliverable = "reel";
    payload.presentation = isReelPresentation(job.presentation) ? job.presentation : undefined;
    // This function is only reached for a RETRY (a fresh clip is created and
    // queued directly by startReelMotionJob, never routed through here) — by
    // this point clip.retryCount has already been incremented past 0 by the
    // caller (qa.ts's rejected branch). Retrying with the identical cue that
    // just failed QA mostly just re-confirms the same failure at full Veo
    // price, so the one retry a reel clip gets uses the shot's deliberately
    // more conservative fallback cue when one exists (see reel-types.ts's
    // engagementCueAlt doc comment) instead of repeating the original bet.
    payload.engagementCue = (clip.retryCount > 0 && shot?.engagementCueAlt) ? shot.engagementCueAlt : shot?.engagementCue;
    payload.lightingDescriptor = lightingDescriptorFor(product?.material, product?.pattern);
    payload.isDetailTruth = shot?.isDetailTruth;
  } else {
    const plan = job.directorPlan ? (JSON.parse(job.directorPlan) as DirectorPlan) : null;
    const planShot = plan?.shots.find((s) => s.view === clip.view);
    payload.motionEmphasis = planShot?.motionEmphasis;
  }

  await db.motionClip.update({ where: { id: clipId }, data: { status: "queued" } });
  const boss = await getBoss();
  await boss.send(QUEUES.MOTION_RENDER, payload);
}

/**
 * Bumps MotionJob.status from "rendering" to "qa" once every clip has left
 * queued/rendering (each has at least reached "qa" or a terminal state) —
 * called from the render worker after each clip finishes. Purely a status-
 * accuracy fix: nothing else in the pipeline reads job.status to decide
 * readiness (maybeAdvanceToCompose below checks CLIP statuses directly),
 * but a retailer-facing progress view will eventually want this to be
 * accurate, and it costs nothing to keep right now.
 */
export async function maybeAdvanceToQA(jobId: string): Promise<void> {
  const job = await db.motionJob.findUnique({ where: { id: jobId }, include: { clips: true } });
  if (!job || job.status !== "rendering") return;
  const stillRendering = job.clips.some((c) => c.status === "queued" || c.status === "rendering");
  if (stillRendering) return;
  await db.motionJob.update({ where: { id: jobId }, data: { status: "qa" } });
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

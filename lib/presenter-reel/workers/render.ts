/**
 * presenter.render job handler — renders one PresenterReelJob via
 * veoPresenterProvider. Deliberately simpler than the catalogue-motion
 * render worker it's modeled on: a single Veo call produces the whole clip
 * (script, voice, lip-sync, gesture together), so there is no separate
 * QA/compose stage to enqueue into — this handler is the entire pipeline
 * for one job, start to finish.
 *
 * Pure handler function, no pg-boss import here — worker/index.ts adapts
 * pg-boss v12's batch-array `.work()` calling convention into per-job calls
 * against this function, same pattern as lib/catalogue-motion/workers/*.
 *
 * Credit-billing: charges/refunds around the provider call, same shape as
 * the catalogue-motion render worker's "motion_clip" handling — priced per
 * second via the new "presenter_clip" BillingOperation (lib/billing/types.ts).
 * getRetailPrice() returns null (→ a $0/free charge, chargeForCall's own
 * documented behavior) until a retail price is actually set — safe to ship
 * wired-but-unpriced. Set the real price at /admin/pricing before this goes
 * live for real retailer usage: Standard-tier Veo runs ~8x the per-second
 * cost the existing motion_clip rate is based on, so it needs its own
 * number, not a copy of that one.
 */
import { db } from "@/lib/db";
import type { PresenterRenderPayload } from "@/lib/queue/types";
import { veoPresenterProvider, nearestPresenterDuration } from "../provider/veo-presenter-provider";
import { uploadWithRetry } from "@/lib/cloudinary";
import { chargeForCall, refundCharge } from "@/lib/billing/charge";
import { finishPresenterClip, cleanupFinishedClip } from "../video-finishing";
import type { EndCardContent } from "../end-card";

const MAX_RENDER_RETRIES = 2; // matches QUEUE_OPTIONS[PRESENTER_RENDER].retryLimit

export async function handlePresenterRender(payload: PresenterRenderPayload): Promise<void> {
  const job = await db.presenterReelJob.findUnique({
    where: { id: payload.jobId },
    select: { id: true, userId: true, ctaMode: true, ctaText: true, endCardData: true },
  });
  if (!job) {
    console.error(`[presenter-reel] job ${payload.jobId} not found — dropping`);
    return;
  }

  // Same try/catch-and-degrade parse pattern used everywhere else this
  // codebase reads a JSON-string column — a malformed endCardData means
  // "no end card" (falls back to a plain hook clip), not a job failure.
  let endCard: EndCardContent | null = null;
  if (job.endCardData) {
    try {
      endCard = JSON.parse(job.endCardData) as EndCardContent;
    } catch {
      console.error(`[presenter-reel] job ${payload.jobId} had unparsable endCardData — rendering without it`);
    }
  }
  const ctaOnScreenText = job.ctaMode === "on_screen" ? job.ctaText : null;

  const durationSec = nearestPresenterDuration(payload.durationSec);
  // Pre-flight credit gate, same shape as every other paid AI call — see
  // lib/catalogue-motion/workers/render.ts's identical motion_clip gate.
  const charge = await chargeForCall(job.userId, "presenter_clip", durationSec);
  if ("insufficientCredits" in charge) {
    await db.presenterReelJob.update({
      where: { id: payload.jobId },
      data: { status: "failed", errorMessage: "insufficient_credits" },
    });
    return;
  }

  await db.presenterReelJob.update({ where: { id: payload.jobId }, data: { status: "rendering" } });

  try {
    const result = await veoPresenterProvider.generateClip({
      sourceImageUrl: payload.sourceImageUrl,
      script: payload.script,
      durationSec,
      productId: payload.productId,
      usage: { feature: "presenter_reel", userId: payload.userId, storeId: payload.userId },
    });

    // Stitch the end card (hook_end_card mode only) and burn in the
    // AI-disclosure label + on-screen CTA before upload — see
    // video-finishing.ts's header for why this needs to be in the pixels,
    // not just our own UI. Falls back to an earlier-stage file on any
    // ffmpeg failure rather than failing an otherwise-successful render.
    const finishedPath = await finishPresenterClip({
      videoBase64: result.videoBase64,
      mimeType: result.mimeType,
      endCard,
      ctaOnScreenText,
    });
    const uploadSource = finishedPath ?? `data:${result.mimeType};base64,${result.videoBase64}`;
    try {
      const upload = await uploadWithRetry(uploadSource, {
        folder: "product-match/presenter-reel",
        resource_type: "video",
      });

      await db.presenterReelJob.update({
        where: { id: payload.jobId },
        data: {
          status: "complete",
          provider: result.provider,
          videoUrl: upload.secure_url,
          durationMs: result.durationMs,
          costUsd: result.costUsd,
        },
      });
    } finally {
      await cleanupFinishedClip(finishedPath);
    }
  } catch (err) {
    // Every failed attempt refunds its own charge — a retried job re-runs
    // chargeForCall from the top on redelivery, so each attempt is charged
    // and (on failure) refunded independently, never left double-charged.
    if (charge.priceCredits > 0) {
      await refundCharge(job.userId, charge.priceCredits, `Refund: presenter_clip render failed (job ${payload.jobId})`);
    }
    await failOrRetry(payload, err);
  }
}

async function failOrRetry(payload: PresenterRenderPayload, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const updated = await db.presenterReelJob.update({
    where: { id: payload.jobId },
    data: { retryCount: { increment: 1 } },
    select: { retryCount: true },
  });

  if (updated.retryCount > MAX_RENDER_RETRIES) {
    await db.presenterReelJob.update({
      where: { id: payload.jobId },
      data: { status: "failed", errorMessage: message.slice(0, 500) },
    });
    return; // terminal — do not rethrow, so pg-boss doesn't redeliver further
  }

  await db.presenterReelJob.update({
    where: { id: payload.jobId },
    data: { status: "queued", errorMessage: message.slice(0, 500) },
  });
  // Rethrow so pg-boss's own queue-level retry (QUEUE_OPTIONS[PRESENTER_RENDER]) redelivers.
  throw err;
}

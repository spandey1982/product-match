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
import { applyDisclosureOverlay, cleanupDisclosureOutput } from "../disclosure-overlay";

const MAX_RENDER_RETRIES = 2; // matches QUEUE_OPTIONS[PRESENTER_RENDER].retryLimit

export async function handlePresenterRender(payload: PresenterRenderPayload): Promise<void> {
  const job = await db.presenterReelJob.findUnique({ where: { id: payload.jobId }, select: { id: true, userId: true } });
  if (!job) {
    console.error(`[presenter-reel] job ${payload.jobId} not found — dropping`);
    return;
  }

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

    // Burn in the AI-disclosure label before upload — see disclosure-overlay.ts's
    // header for why this needs to be in the pixels, not just our own UI.
    // Falls back to the plain video on any ffmpeg failure rather than
    // failing an otherwise-successful render.
    const disclosedPath = await applyDisclosureOverlay(result.videoBase64, result.mimeType);
    const uploadSource = disclosedPath ?? `data:${result.mimeType};base64,${result.videoBase64}`;
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
      if (disclosedPath) await cleanupDisclosureOutput(disclosedPath);
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

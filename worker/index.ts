/**
 * Catalogue Motion worker process — the pg-boss job consumer.
 *
 * A standalone long-running process, deliberately NOT wired into Next.js
 * (no instrumentation.ts hook): Veo's per-clip poll loop runs up to ~2
 * minutes in-process (see lib/catalogue-motion/provider/veo-provider.ts),
 * and later milestones add CPU-bound FFmpeg compose work — neither belongs
 * in the same process serving retailer HTTP traffic. Run locally with
 * `npm run worker:motion` alongside `npm run dev`; in production this needs
 * its own deploy target (a second Railway service sharing DATABASE_URL),
 * not a route inside the web app.
 *
 * Registers `.work()` handlers for whichever queues have a real handler
 * built so far — motion.qa and motion.compose are intentionally not
 * registered yet (later milestones); jobs sent to those queues will simply
 * wait, which is the correct behavior mid-rollout.
 *
 * pg-boss v12's `.work(name, handler)` delivers an ARRAY of jobs per call
 * even though QUEUE_OPTIONS never sets a batchSize (default 1, per pg-boss's
 * own JobFetchOptions) — so in practice this array always holds exactly one
 * job today. Handled with Promise.allSettled anyway so a future batchSize
 * change can't make one job's failure silently swallow the rest; with a
 * single-job batch (the only case that exists right now) its error is
 * rethrown as-is so pg-boss's own per-queue retry policy (QUEUE_OPTIONS)
 * still applies normally.
 */
import "dotenv/config";
import { getBoss } from "@/lib/queue/boss";
import { QUEUES, type MotionRenderPayload } from "@/lib/queue/types";
import { handleMotionRender } from "@/lib/catalogue-motion/workers/render";

async function main() {
  const boss = await getBoss();

  await boss.work<MotionRenderPayload>(QUEUES.MOTION_RENDER, async (jobs) => {
    const results = await Promise.allSettled(jobs.map((job) => handleMotionRender(job.data)));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    for (const f of failures) console.error("[worker] motion.render job failed:", f.reason);
    if (failures.length > 0) throw failures[0].reason;
  });

  console.log("[worker] catalogue-motion worker started — listening on:", Object.values(QUEUES).join(", "));
}

main().catch((err) => {
  console.error("[worker] fatal startup error:", err);
  process.exit(1);
});

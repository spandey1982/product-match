import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MotionReviewView, type MotionReviewClip } from "./MotionReviewView";

export const metadata = { title: "Catalogue Motion Review — Internal" };

/**
 * Internal-only manual review panel for Catalogue Motion clips QA landed in
 * "manual_review" on — the minimal admin action M3 needs so a job doesn't
 * stall forever waiting for a human decision (see lib/catalogue-motion/
 * workers/qa.ts's wide accept/reject band). Same admin-gating convention as
 * the existing photo review panel (app/(dashboard)/admin/review): non-admins
 * get a 404, not a hint this exists.
 */
export default async function MotionReviewPage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const clips = await db.motionClip.findMany({
    where: { status: "qa", qa: { verdict: "manual_review" } },
    orderBy: { createdAt: "asc" },
    take: 60,
    include: {
      qa: true,
      job: { select: { id: true, productId: true, product: { select: { title: true, category: true } } } },
    },
  });

  const initialClips: MotionReviewClip[] = clips.map((c) => ({
    id: c.id,
    view: c.view,
    presetId: c.presetId,
    sourceImageUrl: c.sourceImageUrl,
    outputUrl: c.outputUrl,
    plannedHoldSec: c.plannedHoldSec,
    productTitle: c.job.product.title,
    category: c.job.product.category,
    scores: c.qa
      ? {
          identityConsistency: c.qa.identityConsistency,
          garmentPreservation: c.qa.garmentPreservation,
          textureConsistency: c.qa.textureConsistency,
          lightingStability: c.qa.lightingStability,
          backgroundStability: c.qa.backgroundStability,
          motionSmoothness: c.qa.motionSmoothness,
          artifactScore: c.qa.artifactScore,
          overall: c.qa.overall,
        }
      : null,
    issues: c.qa?.issues ?? null,
  }));

  return <MotionReviewView initialClips={initialClips} />;
}

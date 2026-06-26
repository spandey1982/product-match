import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReviewPanelView, type ReviewRecord } from "./ReviewPanelView";

export const metadata = { title: "Generation Review — Internal" };

/**
 * Internal-only manual review panel (Phase G). Admin-gated: non-admins get a
 * 404 (no hint it exists). Not linked from any retailer/customer navigation.
 */
export default async function AdminReviewPage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const records = (await db.generationRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      productId: true,
      category: true,
      provider: true,
      objective: true,
      view: true,
      outputUrl: true,
      aiOverall: true,
      aiAuthenticity: true,
      aiRealism: true,
      aiGarmentPreservation: true,
      aiDrapeQuality: true,
      aiPatternPreservation: true,
      aiRenderingQuality: true,
      aiTextureQuality: true,
      aiProductVisibility: true,
      aiIssues: true,
      manualScore: true,
      manualReviewer: true,
      createdAt: true,
    },
  })) as unknown as ReviewRecord[];

  return <ReviewPanelView initialRecords={records} />;
}

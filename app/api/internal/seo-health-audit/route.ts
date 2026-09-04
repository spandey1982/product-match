import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeHealthScore } from "@/lib/seo/health-score";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.SEO_HEALTH_AUDIT_SECRET;
  if (!secret) return false;

  const provided = req.headers.get("x-audit-secret") ?? "";
  try {
    return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
  } catch {
    return false;
  }
}

/**
 * Computes lib/seo/health-score.ts's GEO/AEO/SEO content-completeness score
 * and persists one SeoHealthSnapshot row — the time series that answers "is
 * this actually improving" and "did something regress" (see
 * prisma/schema.prisma's SeoHealthSnapshot doc comment). Meant to be
 * triggered by an external scheduler (e.g. a Railway Cron Job) hitting this
 * route on a timer — this repo has no in-process scheduler, same posture as
 * /api/internal/purge-deleted-accounts. Secret-gated rather than
 * session-gated since the caller isn't a logged-in user.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const breakdown = await computeHealthScore();
    const snapshot = await db.seoHealthSnapshot.create({
      data: { score: breakdown.overallScore, breakdown: JSON.stringify(breakdown) },
    });
    return NextResponse.json({ id: snapshot.id, score: snapshot.score, createdAt: snapshot.createdAt, breakdown });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

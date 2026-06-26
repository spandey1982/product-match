import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Internal manual-review API (Phase G). Admin-only. Lists generation records
 * for review and stores a 1–5 manual score onto the existing GenerationRecord
 * row (alongside the AI scores). Not exposed to retailers/customers.
 */

const REVIEW_FIELDS = {
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
} as const;

function mapError(err: unknown): NextResponse | null {
  const msg = (err as Error).message;
  if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// GET — recent generation records (optionally only unrated).
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const unratedOnly = searchParams.get("unrated") === "1";
    const limit = Math.min(parseInt(searchParams.get("limit") || "60"), 200);

    const records = await db.generationRecord.findMany({
      where: unratedOnly ? { manualScore: null } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: REVIEW_FIELDS,
    });

    return NextResponse.json({ records });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — set the manual 1–5 score for a record.
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const id = (body as { id?: unknown }).id;
    const manualScore = (body as { manualScore?: unknown }).manualScore;

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing record id." }, { status: 400 });
    }
    if (
      typeof manualScore !== "number" ||
      !Number.isInteger(manualScore) ||
      manualScore < 1 ||
      manualScore > 5
    ) {
      return NextResponse.json({ error: "manualScore must be an integer 1–5." }, { status: 400 });
    }

    const updated = await db.generationRecord.update({
      where: { id },
      data: {
        manualScore,
        manualReviewer: session.email,
        manualReviewedAt: new Date(),
      },
      select: REVIEW_FIELDS,
    });

    return NextResponse.json({ record: updated });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

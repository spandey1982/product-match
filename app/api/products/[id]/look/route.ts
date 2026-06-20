import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildLook } from "@/lib/look-builder";
import { deserializeProduct } from "@/lib/serialize";

/**
 * GET /api/products/[id]/look
 *
 * Build the complete-look candidate set around an anchor product: the system's
 * slot template for the anchor's category, each slot filled with ranked
 * candidate products from the retailer's own catalog. Read-only; nothing is
 * generated or persisted here.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const perSlot = Math.min(
      24,
      Math.max(1, parseInt(searchParams.get("limit") || "8"))
    );

    // Anchor must belong to the requesting retailer.
    const anchor = await db.product.findFirst({
      where: { id, userId: session.id },
    });
    if (!anchor) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Candidate pool: the retailer's active, in-stock catalog. buildLook also
    // filters per slot, but pre-filtering keeps the working set small.
    const catalog = await db.product.findMany({
      where: { userId: session.id, isActive: true, inStock: true },
    });

    const look = buildLook(anchor, catalog, { perSlot });

    return NextResponse.json({
      anchor: deserializeProduct(anchor as unknown as Record<string, unknown>),
      hasTemplate: look.template !== null,
      templateLabel: look.template?.label ?? null,
      slots: look.slots.map((s) => ({
        id: s.slot.id,
        label: s.slot.label,
        required: s.slot.required,
        max: s.slot.max,
        candidates: s.candidates.map((c) => ({
          product: deserializeProduct(
            c.product as unknown as Record<string, unknown>
          ),
          matchScore: c.matchScore,
          explanation: c.explanation,
          explanationTags: c.explanationTags,
        })),
      })),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[look] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

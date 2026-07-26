import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

const FEATURE_LABELS: Record<string, string> = {
  catalogue: "Catalogue",
  quick_listing: "Quick Listing",
  tryon: "Try-On",
  fashion_designer: "Design Studio",
  rental_order: "Rental Orders",
};

const TRACKED_FEATURES = new Set(Object.keys(FEATURE_LABELS));

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const dateWhere = Object.keys(dateFilter).length > 0
      ? { createdAt: dateFilter }
      : {};

    // fashion_designer and catalogue are deliberately excluded here — both
    // record MULTIPLE ai_usage_events rows per successful run (fashion design:
    // 5-7 rows across analysis + planning + front/back image gen; catalogue:
    // a separate row per base shot, front + back), so counting rows would
    // count "operations," not completed generations. Both are counted
    // separately below, by their own success signal.
    const rows = await db.aiUsageEvent.groupBy({
      by: ["feature"],
      where: {
        userId: session.id,
        status: "success",
        feature: { notIn: ["fashion_designer", "catalogue"] },
        ...dateWhere,
      },
      _count: { id: true },
    });

    const featureMap = new Map<string, number>();
    for (const row of rows) {
      if (TRACKED_FEATURES.has(row.feature)) {
        featureMap.set(row.feature, (featureMap.get(row.feature) ?? 0) + row._count.id);
      }
    }

    // Fashion Designer — count once per design whose pipeline ran to
    // completion with at least one generated image (the "green ready"
    // state in DesignView), not once per AI call. `stage: "completed"` alone
    // isn't enough: a design can reach "completed" with image generation
    // itself having failed (analysis-only completion), which is not a
    // successful design in the retailer's terms. Bucketed by `updatedAt`
    // since that's when the row last settled into "completed" — `createdAt`
    // would bucket by when the design was STARTED, which can be a different
    // day than when it finished (e.g. paused for insufficient credits and
    // resumed later, exactly the scenario that surfaced this bug).
    const fashionDesignDateWhere = Object.keys(dateFilter).length > 0
      ? { updatedAt: dateFilter }
      : {};
    const completedDesigns = await db.fashionDesign.count({
      where: {
        userId: session.id,
        stage: "completed",
        OR: [{ flatFrontUrl: { not: null } }, { flatBackUrl: { not: null } }],
        ...fashionDesignDateWhere,
      },
    });
    if (completedDesigns > 0) featureMap.set("fashion_designer", completedDesigns);

    // Catalogue — count once per successful catalogue generation, not once
    // per base shot. Every successful run (fresh, Recreate, or a Resume that
    // completes a partial catalogue) persists exactly one "front" ProductImage
    // row — the mandatory hero shot the strategy refuses to persist without
    // (see catalogue.ts's discard-on-missing-front guard) — so it's a clean
    // 1:1 proxy for "a catalogue was successfully generated," independent of
    // how many base/crop images that run produced.
    const completedCatalogueRuns = await db.productImage.count({
      where: {
        objective: "catalogue",
        view: "front",
        product: { userId: session.id },
        ...dateWhere,
      },
    });
    if (completedCatalogueRuns > 0) featureMap.set("catalogue", completedCatalogueRuns);

    // Rental orders — only counted for rental stores. Scoped via products
    // owned by this user since RentalOrder has no direct userId.
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { businessType: true },
    });
    if (user?.businessType === "RENTAL_STORE") {
      const storeProductIds = await db.product.findMany({
        where: { userId: session.id },
        select: { id: true },
      });
      const productIds = storeProductIds.map((p) => p.id);
      if (productIds.length > 0) {
        const count = await db.rentalOrder.count({
          where: {
            productId: { in: productIds },
            ...dateWhere,
          },
        });
        if (count > 0) featureMap.set("rental_order", count);
      }
    }

    const features = Array.from(featureMap.entries())
      .map(([id, count]) => ({
        id,
        label: FEATURE_LABELS[id] ?? id,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const totalCount = features.reduce((sum, f) => sum + f.count, 0);

    return NextResponse.json({ features, totalCount });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { MATERIAL_TAXONOMY } from "@/lib/home-material/material-taxonomy";
import type { BrowseProduct } from "@/lib/home-material/browse-product";
import { MaterialsLandingClient } from "./MaterialsLandingClient";

// Home Material Intelligence Platform — landing + Mode A browse, merged
// into one screen per the 2026-09-10 UI discovery decision (Q1/Q2 in
// research/home-material-ui-discovery.html): a standalone catalogue-browse
// page ("I know what I want", no room upload required) doubles as the
// marketing entry point, since the two closest real competitors (Roomvo,
// IKEA Kreativ) both open directly into a working tool rather than a
// generic hero. Layout follows the "Sage Studio" prototype the user
// picked (research/ui-prototype-a-sage-studio.html) — see
// docs/home-material/ui/decisions.md. See docs/home-material/README.md
// for the domain brief.

export const metadata: Metadata = {
  title: "Home Material Intelligence",
  description: "See real paint, wallpaper, texture, and wall panels on your own wall before you buy — browse materials or start with your room.",
};

// Prices and the product list itself change independently of a deploy
// (retailer listings, new demo/custom products) — this must never serve a
// build-time snapshot of pricing, per the domain's cost-honesty principle.
export const dynamic = "force-dynamic";

async function getBrowseProducts(): Promise<BrowseProduct[]> {
  // Curated/public products only — a signed-out visitor is the primary
  // audience for this page, and a private custom upload belongs to
  // exactly one HmUser, never shown here.
  const products = await db.hmProduct.findMany({
    where: { uploadedByHmUserId: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      colorName: true,
      colorHex: true,
      finish: true,
      patternName: true,
      textureAssetUrl: true,
      priceInr: true,
      priceUnit: true,
      material: {
        select: {
          category: true,
          subtype: true,
          avgCostPerSqftMinInr: true,
          avgCostPerSqftMaxInr: true,
        },
      },
      retailerListings: {
        where: { priceInr: { not: null } },
        orderBy: { priceInr: "asc" },
        take: 1,
        select: { priceInr: true },
      },
    },
  });

  return products.map((p) => {
    const realPrice = p.retailerListings[0]?.priceInr ?? null;
    // Structured durability/maintenance figures live only in the typed
    // MATERIAL_TAXONOMY source (lib/home-material/recommendation.ts's
    // scorer already treats it as authoritative) — HmMaterial's DB row
    // only carries prose (durability/maintenance as full sentences), not
    // these derived fields, so look the taxonomy entry up by category+
    // subtype rather than duplicating structured columns into the schema.
    const taxonomyEntry = p.material
      ? MATERIAL_TAXONOMY.find((t) => t.category === p.material!.category && t.subtype === p.material!.subtype)
      : undefined;
    return {
      id: p.id,
      name: p.name,
      colorHex: p.colorHex,
      finish: p.finish,
      patternName: p.patternName,
      textureAssetUrl: p.textureAssetUrl,
      category: p.material?.category ?? null,
      subtype: p.material?.subtype ?? null,
      durabilityYearsApprox: taxonomyEntry?.durabilityYearsApprox ?? null,
      maintenanceLevel: taxonomyEntry?.maintenanceLevel ?? null,
      priceInr: realPrice,
      priceIsExact: realPrice != null,
      costRangeMinInr: realPrice == null ? p.material?.avgCostPerSqftMinInr ?? null : null,
      costRangeMaxInr: realPrice == null ? p.material?.avgCostPerSqftMaxInr ?? null : null,
    };
  });
}

export interface SubtypeOption {
  subtype: string;
  label: string;
}

const CATEGORY_ORDER = ["paint", "wallpaper", "wall_texture", "wall_panel"];

/**
 * Subtype chip order per category, "most bought/trending/popular" first
 * (2026-09-14 browse-parity work) — a deterministic, explainable
 * popularity signal rather than a black-box ranking, matching this
 * domain's recommendation-engine philosophy. Weighted sum of three real
 * signals per product (HmLead — closest thing to "bought" this domain
 * has, no checkout yet; HmVisualization — "tried in a room"; HmShortlist
 * Item — "saved for later"), weighted toward stronger intent:
 * leads×3 + visualizations×2 + shortlists×1. Ties (expected pre-launch,
 * when every count is 0) fall back to MATERIAL_TAXONOMY's own declared
 * order rather than an arbitrary DB order, so the row is never visibly
 * random. Only subtypes with at least one real listed product appear —
 * same "don't offer a chip that leads to an empty grid" rule /shop's own
 * subcategories already follow (app/api/public/products/route.ts).
 */
async function getSubtypesByCategory(products: BrowseProduct[]): Promise<Record<string, SubtypeOption[]>> {
  const [leadCounts, visualizationCounts, shortlistCounts] = await Promise.all([
    db.hmLead.groupBy({ by: ["productId"], where: { productId: { not: null } }, _count: { _all: true } }),
    db.hmVisualization.groupBy({ by: ["productId"], where: { productId: { not: null } }, _count: { _all: true } }),
    db.hmShortlistItem.groupBy({ by: ["productId"], _count: { _all: true } }),
  ]);

  const scoreByProductId = new Map<string, number>();
  function addScore(rows: { productId: string | null; _count: { _all: number } }[], weight: number) {
    for (const row of rows) {
      if (!row.productId) continue;
      scoreByProductId.set(row.productId, (scoreByProductId.get(row.productId) ?? 0) + row._count._all * weight);
    }
  }
  addScore(leadCounts, 3);
  addScore(visualizationCounts, 2);
  addScore(shortlistCounts, 1);

  const scoreBySubtypeKey = new Map<string, number>();
  for (const p of products) {
    if (!p.category || !p.subtype) continue;
    const key = `${p.category}:${p.subtype}`;
    scoreBySubtypeKey.set(key, (scoreBySubtypeKey.get(key) ?? 0) + (scoreByProductId.get(p.id) ?? 0));
  }

  const result: Record<string, SubtypeOption[]> = {};
  for (const category of CATEGORY_ORDER) {
    const presentSubtypes = Array.from(new Set(products.filter((p) => p.category === category && p.subtype).map((p) => p.subtype as string)));
    result[category] = presentSubtypes
      .map((subtype) => {
        const taxonomyIndex = MATERIAL_TAXONOMY.findIndex((t) => t.category === category && t.subtype === subtype);
        const label = taxonomyIndex >= 0 ? MATERIAL_TAXONOMY[taxonomyIndex].name : subtype;
        return {
          subtype,
          label,
          score: scoreBySubtypeKey.get(`${category}:${subtype}`) ?? 0,
          taxonomyIndex: taxonomyIndex >= 0 ? taxonomyIndex : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((a, b) => b.score - a.score || a.taxonomyIndex - b.taxonomyIndex)
      .map(({ subtype, label }) => ({ subtype, label }));
  }
  return result;
}

export default async function MaterialsPage() {
  const products = await getBrowseProducts();
  const subtypesByCategory = await getSubtypesByCategory(products);
  return (
    <Suspense fallback={null}>
      <MaterialsLandingClient products={products} subtypesByCategory={subtypesByCategory} />
    </Suspense>
  );
}

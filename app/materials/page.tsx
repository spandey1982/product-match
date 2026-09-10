import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { MATERIAL_TAXONOMY } from "@/lib/home-material/material-taxonomy";
import { MaterialsLandingClient, type BrowseProduct } from "./MaterialsLandingClient";

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
      category: p.material?.category ?? null,
      durabilityYearsApprox: taxonomyEntry?.durabilityYearsApprox ?? null,
      maintenanceLevel: taxonomyEntry?.maintenanceLevel ?? null,
      priceInr: realPrice,
      priceIsExact: realPrice != null,
      costRangeMinInr: realPrice == null ? p.material?.avgCostPerSqftMinInr ?? null : null,
      costRangeMaxInr: realPrice == null ? p.material?.avgCostPerSqftMaxInr ?? null : null,
    };
  });
}

export default async function MaterialsPage() {
  const products = await getBrowseProducts();
  return (
    <Suspense fallback={null}>
      <MaterialsLandingClient products={products} />
    </Suspense>
  );
}

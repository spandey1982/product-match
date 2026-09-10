import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { MATERIAL_TAXONOMY } from "@/lib/home-material/material-taxonomy";

// Home Material Intelligence Platform — landing + Mode A browse, merged
// into one screen per the 2026-09-10 UI discovery decision (Q1/Q2 in
// research/home-material-ui-discovery.html): a standalone catalogue-browse
// page ("I know what I want", no room upload required) doubles as the
// marketing entry point, since the two closest real competitors (Roomvo,
// IKEA Kreativ) both open directly into a working tool rather than a
// generic hero. See docs/home-material/README.md for the domain brief.

export const metadata: Metadata = {
  title: "Home Material Intelligence",
  description: "See real paint, wallpaper, texture, and wall panels on your own wall before you buy — browse materials or start with your room.",
};

// Prices and the product list itself change independently of a deploy
// (retailer listings, new demo/custom products) — this must never serve a
// build-time snapshot of pricing, per the domain's cost-honesty principle.
export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  paint: "Paint",
  wallpaper: "Wallpaper",
  wall_texture: "Wall Texture",
  wall_panel: "Wall Panels",
};
const CATEGORY_ORDER = ["paint", "wallpaper", "wall_texture", "wall_panel"];

async function getBrowseProducts() {
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

const MAINTENANCE_LABELS: Record<string, string> = { low: "Low maintenance", medium: "Some maintenance", high: "High maintenance" };

/**
 * Compact suitability signal on an otherwise identity-only card (2026-09-10
 * Discovery-layer vocabulary pass) — category-level facts from
 * lib/home-material/material-taxonomy.ts, true for every product of this
 * material regardless of which specific SKU, so safe to show without room
 * context. Full material detail (moisture suitability, installation,
 * pros/cons) stays on /materials/guide — this is a hint, not the whole
 * picture.
 */
function SuitabilityChips({ p }: { p: Awaited<ReturnType<typeof getBrowseProducts>>[number] }) {
  if (p.durabilityYearsApprox == null && !p.maintenanceLevel) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.durabilityYearsApprox != null && (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">~{p.durabilityYearsApprox}yr durability</span>
      )}
      {p.maintenanceLevel && (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{MAINTENANCE_LABELS[p.maintenanceLevel] ?? p.maintenanceLevel}</span>
      )}
    </div>
  );
}

function PriceTag({ p }: { p: Awaited<ReturnType<typeof getBrowseProducts>>[number] }) {
  if (p.priceIsExact) return <span className="text-sm font-medium text-gray-900">₹{p.priceInr} / sq.ft</span>;
  if (p.costRangeMinInr != null && p.costRangeMaxInr != null) {
    return <span className="text-sm text-gray-500">₹{p.costRangeMinInr}–₹{p.costRangeMaxInr} / sq.ft (indicative)</span>;
  }
  return <span className="text-sm text-gray-400">Price on request</span>;
}

export default async function MaterialsPage() {
  const products = await getBrowseProducts();
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: products.filter((p) => p.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen">
      <section className="px-6 py-16 sm:py-20 text-center bg-gradient-to-b from-indigo-50/60 to-transparent">
        <div className="max-w-2xl mx-auto space-y-5">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 text-balance">
            See real materials on your own wall before you buy.
          </h1>
          <p className="text-gray-600 text-base sm:text-lg max-w-xl mx-auto">
            Upload one photo of your room. Try real paint, wallpaper, texture, and wall panels on the actual wall —
            not a mockup — then compare, estimate cost, and request a sample or quote when you&apos;re confident.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/materials/upload">
              <Button size="lg">
                Upload your room <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/materials/guide">
              <Button size="lg" variant="secondary">Browse the material guide</Button>
            </Link>
            <Link href="/materials/shortlist">
              <Button size="lg" variant="ghost">My shortlist</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-900">Already know what you want?</h2>
          <p className="text-sm text-gray-500 mt-1">
            Browse real materials below. Pick one and see it in your own room — no account or upload needed until then.
          </p>
        </div>

        {byCategory.length === 0 && (
          <p className="text-sm text-gray-400 text-center">No materials available yet — check back soon.</p>
        )}

        {byCategory.map((g) => (
          <div key={g.category} className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
              {CATEGORY_LABELS[g.category] ?? g.category}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.items.map((p) => (
                <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {p.colorHex && (
                      <span
                        className="h-10 w-10 rounded-lg border border-gray-200 shrink-0"
                        style={{ backgroundColor: p.colorHex }}
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {[p.patternName, p.finish].filter(Boolean).join(" · ") || (CATEGORY_LABELS[g.category] ?? g.category)}
                      </p>
                    </div>
                  </div>
                  <SuitabilityChips p={p} />
                  <PriceTag p={p} />
                  <Link href={`/materials/upload?product=${p.id}`} className="block">
                    <Button size="sm" className="w-full">See in my room</Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

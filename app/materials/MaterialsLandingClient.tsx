"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadRoomModal } from "@/components/home-material/UploadRoomModal";

export type BrowseProduct = {
  id: string;
  name: string;
  colorHex: string | null;
  finish: string | null;
  patternName: string | null;
  category: string | null;
  durabilityYearsApprox: number | null;
  maintenanceLevel: string | null;
  priceInr: number | null;
  priceIsExact: boolean;
  costRangeMinInr: number | null;
  costRangeMaxInr: number | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  paint: "Paint",
  wallpaper: "Wallpaper",
  wall_texture: "Wall Texture",
  wall_panel: "Wall Panels",
};
const CATEGORY_ORDER = ["paint", "wallpaper", "wall_texture", "wall_panel"];
const MAINTENANCE_LABELS: Record<string, string> = { low: "Low maintenance", medium: "Some maintenance", high: "High maintenance" };

function PriceTag({ p }: { p: BrowseProduct }) {
  if (p.priceIsExact) return <span className="text-sm font-semibold text-gray-900">₹{p.priceInr} / sq.ft</span>;
  if (p.costRangeMinInr != null && p.costRangeMaxInr != null) {
    return <span className="text-sm text-gray-500">₹{p.costRangeMinInr}–₹{p.costRangeMaxInr} / sq.ft</span>;
  }
  return <span className="text-sm text-gray-400">Price on request</span>;
}

/**
 * Landing + Mode A browse client wiring (2026-09-10, Sage Studio layout
 * pass) — the prior version reused the app's existing generic page
 * shape (centered hero, plain stacked cards); the user asked for the
 * ACTUAL layout shown in the Sage Studio prototype (split hero with a
 * room illustration, filter chips, a hover-revealing 4-up card grid),
 * not just the retheme colors/fonts applied on top of the old
 * structure. This is that layout, wired to real data and real actions.
 *
 * Room upload is now a modal (`UploadRoomModal`), not a separate
 * `/materials/upload` page, per the same instruction — both the hero
 * CTA and every card's "See in my room" open it, carrying a productId
 * through when relevant. `?openUpload=1[&product=...]` (used by the
 * post-login redirect, since a mid-upload 401 can't survive with the
 * file object intact) re-opens it automatically on load.
 */
export function MaterialsLandingClient({ products }: { products: BrowseProduct[] }) {
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(searchParams.get("openUpload") === "1");
  const [modalProductId, setModalProductId] = useState<string | null>(searchParams.get("product"));
  const [activeCategory, setActiveCategory] = useState<string>("all");

  function openUpload(productId?: string) {
    setModalProductId(productId ?? null);
    setModalOpen(true);
  }

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: products.filter((p) => p.category === cat),
  })).filter((g) => g.items.length > 0);

  const visibleCategories = activeCategory === "all" ? byCategory : byCategory.filter((g) => g.category === activeCategory);

  return (
    <div className="min-h-screen">
      <UploadRoomModal open={modalOpen} onOpenChange={setModalOpen} productId={modalProductId} />

      <section className="px-6 py-14 sm:py-20 bg-gradient-to-b from-[var(--color-indigo-50)]/60 to-transparent">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 text-balance leading-tight">
              See real materials on your own wall before you buy.
            </h1>
            <p className="text-gray-600 text-base sm:text-lg mt-4 max-w-md">
              Upload one photo of your room. Try real paint, wallpaper, texture, and wall panels on the actual wall —
              not a mockup — then compare, estimate cost, and request a sample or quote when you&apos;re confident.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-6">
              <Button size="lg" onClick={() => openUpload()}>
                Upload your room <ArrowRight className="h-4 w-4" />
              </Button>
              <Link href="/materials/guide">
                <Button size="lg" variant="secondary">Browse the material guide</Button>
              </Link>
              <Link href="/materials/shortlist">
                <Button size="lg" variant="ghost">My shortlist</Button>
              </Link>
            </div>
          </div>
          <div className="relative rounded-[20px] bg-white/60 border border-gray-200 p-4">
            <svg viewBox="0 0 420 300" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-2xl overflow-hidden">
              <rect width="420" height="300" fill="#f6f1e6" />
              <rect width="420" height="46" fill="#fbf8f1" />
              <polygon points="0,46 250,46 220,260 0,260" fill="#c9d6c0" />
              <polygon points="250,46 420,46 420,260 220,260" fill="#6f8a5e" />
              <line x1="250" y1="46" x2="220" y2="260" stroke="#4a5f3f" strokeWidth="2" />
              <rect x="0" y="260" width="420" height="40" fill="#a98863" />
              <rect x="40" y="150" width="70" height="90" fill="#4a3728" />
            </svg>
            <div className="absolute bottom-6 right-6 bg-white rounded-2xl shadow-lg p-3 flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-lg block shrink-0" style={{ backgroundColor: "#6f8a5e" }} />
              <div>
                <p className="text-xs font-semibold text-gray-900 leading-tight">Botanical Leaf</p>
                <p className="text-[11px] text-gray-400 leading-tight">Wallpaper</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-900">Already know what you want?</h2>
          <p className="text-sm text-gray-500 mt-1">
            Browse real materials below. Pick one and see it in your own room — no account or upload needed until then.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
              activeCategory === "all" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            All
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
                activeCategory === cat ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {visibleCategories.length === 0 && (
          <p className="text-sm text-gray-400 text-center">No materials available yet — check back soon.</p>
        )}

        {visibleCategories.map((g) => (
          <div key={g.category} className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
              {CATEGORY_LABELS[g.category] ?? g.category}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {g.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openUpload(p.id)}
                  className="group text-left rounded-2xl border border-gray-200 bg-white overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-gray-300"
                >
                  <div className="h-28 overflow-hidden">
                    <div
                      className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundColor: p.colorHex || "#e5e7eb" }}
                    />
                  </div>
                  <div className="p-4 space-y-2">
                    <div>
                      <p className="font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {[p.patternName, p.finish].filter(Boolean).join(" · ") || (CATEGORY_LABELS[g.category] ?? g.category)}
                      </p>
                    </div>
                    {(p.durabilityYearsApprox != null || p.maintenanceLevel) && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.durabilityYearsApprox != null && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">~{p.durabilityYearsApprox}yr durability</span>
                        )}
                        {p.maintenanceLevel && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{MAINTENANCE_LABELS[p.maintenanceLevel] ?? p.maintenanceLevel}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <PriceTag p={p} />
                      <span className="text-xs font-semibold text-indigo-700 opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0">
                        See in my room →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

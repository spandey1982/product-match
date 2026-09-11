"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

// Tier-0 deterministic intent matching (2026-09-11, intent-first entry —
// see docs/home-material/product/roadmap.md and
// research/home-material-intent-first-review.html). Deliberately no AI
// call and no embeddings: plain keyword/category/price extraction over
// the SAME `products` array already fetched server-side for the chip
// grid below — zero new API calls, zero new cost. Reserved for a future
// Tier 1 (embedding retrieval) only once the catalogue is large enough
// to need it; see the review's §Product Intelligence for that trigger.
const CATEGORY_QUERY_KEYWORDS: Record<string, string[]> = {
  paint: ["paint", "emulsion"],
  wallpaper: ["wallpaper", "wall paper"],
  wall_texture: ["texture", "textured", "plaster"],
  wall_panel: ["panel", "panels"],
};
const STOPWORDS = new Set([
  "a", "an", "the", "for", "my", "in", "on", "is", "to", "of", "with", "i", "want", "looking",
  "need", "please", "something", "some", "me", "find", "show", "and", "or", "that", "this",
]);

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

function parsePriceMax(query: string): number | null {
  const m = query.match(/(?:under|below|less than|max(?:imum)?|up ?to)\s*₹?\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Returns -1 for a hard exclude (price ceiling violated), else a relevance score (0 = no signal). */
function scoreProduct(p: BrowseProduct, tokens: string[], rawQueryLower: string, priceMax: number | null): number {
  if (priceMax != null) {
    const price = p.priceIsExact ? p.priceInr : p.costRangeMaxInr;
    if (price != null && price > priceMax) return -1;
  }
  let score = 0;
  const catKeywords = p.category ? CATEGORY_QUERY_KEYWORDS[p.category] ?? [] : [];
  if (catKeywords.some((k) => rawQueryLower.includes(k))) score += 3;
  const haystack = `${p.name} ${p.patternName ?? ""} ${p.finish ?? ""}`.toLowerCase();
  for (const t of tokens) {
    if (haystack.includes(t)) score += 1;
  }
  return score;
}

function PriceTag({ p }: { p: BrowseProduct }) {
  if (p.priceIsExact) return <span className="text-sm font-semibold text-gray-900">₹{p.priceInr} / sq.ft</span>;
  if (p.costRangeMinInr != null && p.costRangeMaxInr != null) {
    return <span className="text-sm text-gray-500">₹{p.costRangeMinInr}–₹{p.costRangeMaxInr} / sq.ft</span>;
  }
  return <span className="text-sm text-gray-400">Price on request</span>;
}

function ProductCard({ p, categoryLabel, onOpen }: { p: BrowseProduct; categoryLabel: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
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
          <p className="text-xs text-gray-400">{[p.patternName, p.finish].filter(Boolean).join(" · ") || categoryLabel}</p>
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
  );
}

/**
 * Landing + Mode A browse client wiring. Sage Studio layout (2026-09-10)
 * plus the intent-first entry (2026-09-11, "Option C — sentence
 * continuation" chosen from research/prototypes/ui-prototype-intent-
 * entry-options.html): the intent input reads as the headline finishing
 * its own thought rather than a separate search form, and demotes
 * upload/browse to secondary text links WITHOUT hiding the product grid
 * below, which renders unchanged whether or not a query is active — see
 * docs/home-material/product/roadmap.md for why the grid must never be
 * hidden behind the input.
 *
 * Room upload is a modal (`UploadRoomModal`), not a separate
 * `/materials/upload` page — both the hero CTA and every card's "See in
 * my room" open it, carrying a productId through when relevant.
 * `?openUpload=1[&product=...]` (used by the post-login redirect, since a
 * mid-upload 401 can't survive with the file object intact) re-opens it
 * automatically on load.
 */
export function MaterialsLandingClient({ products }: { products: BrowseProduct[] }) {
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(searchParams.get("openUpload") === "1");
  const [modalProductId, setModalProductId] = useState<string | null>(searchParams.get("product"));
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  function openUpload(productId?: string) {
    setModalProductId(productId ?? null);
    setModalOpen(true);
  }

  function handleIntentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setActiveCategory("all");
    setActiveQuery(trimmed);
  }

  function clearSearch() {
    setActiveQuery(null);
    setQuery("");
  }

  function selectCategory(cat: string) {
    setActiveQuery(null);
    setActiveCategory(cat);
  }

  const priceMax = activeQuery ? parsePriceMax(activeQuery) : null;
  const tokens = activeQuery ? tokenize(activeQuery) : [];
  const rawQueryLower = activeQuery?.toLowerCase() ?? "";
  const scored = activeQuery
    ? products
        .map((p) => ({ p, score: scoreProduct(p, tokens, rawQueryLower, priceMax) }))
        .filter((x) => x.score >= 0)
    : [];
  const matched = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.p);
  const hasConfidentMatches = activeQuery != null && matched.length > 0;

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
              Tell us what you&apos;re picturing — we&apos;ll bring the closest real products to you first. Or browse
              paint, wallpaper, texture, and wall panels below and try any of them on a photo of your own room.
            </p>

            <form onSubmit={handleIntentSubmit} className="mt-6 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white pl-4 pr-1.5 py-1.5 max-w-md shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-400">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. "something warm and elegant for my living room"'
                className="flex-1 min-w-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
              />
              <button
                type="submit"
                aria-label="Find matching materials"
                className="h-8 w-8 shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3">
              <button type="button" onClick={() => openUpload()} className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2">
                Or upload a photo of your room
              </button>
              <Link href="/materials/guide" className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2">
                Browse the material guide
              </Link>
              <Link href="/materials/shortlist" className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2">
                My shortlist
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
        {activeQuery ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {hasConfidentMatches ? <>Matches for &ldquo;{activeQuery}&rdquo;</> : <>Nothing close for &ldquo;{activeQuery}&rdquo; yet</>}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {hasConfidentMatches
                  ? "Worth exploring, based on what you described. Pick one to see it on your own wall."
                  : "Here's the full catalogue instead — browse by category below, or try describing it differently."}
              </p>
            </div>
            <button type="button" onClick={clearSearch} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0">
              Clear search
            </button>
          </div>
        ) : (
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-900">Already know what you want?</h2>
            <p className="text-sm text-gray-500 mt-1">
              Browse real materials below. Pick one and see it in your own room — no account or upload needed until then.
            </p>
          </div>
        )}

        {hasConfidentMatches ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {matched.map((p) => (
              <ProductCard key={p.id} p={p} categoryLabel={CATEGORY_LABELS[p.category ?? ""] ?? "Material"} onOpen={() => openUpload(p.id)} />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => selectCategory("all")}
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
                  onClick={() => selectCategory(cat)}
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
                    <ProductCard key={p.id} p={p} categoryLabel={CATEGORY_LABELS[g.category] ?? g.category} onOpen={() => openUpload(p.id)} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}

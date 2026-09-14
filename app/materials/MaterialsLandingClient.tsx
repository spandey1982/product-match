"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { UploadRoomModal } from "@/components/home-material/UploadRoomModal";
import { MaterialBrowseSection } from "@/components/home-material/MaterialBrowseSection";
import { MaterialProductCard } from "@/components/home-material/MaterialProductCard";
import type { BrowseProduct } from "@/lib/home-material/browse-product";
import type { SubtypeOption } from "./page";

export type { BrowseProduct };

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
export function MaterialsLandingClient({
  products,
  subtypesByCategory,
}: {
  products: BrowseProduct[];
  subtypesByCategory: Record<string, SubtypeOption[]>;
}) {
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(searchParams.get("openUpload") === "1");
  const [modalProductId, setModalProductId] = useState<string | null>(searchParams.get("product"));
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
    setActiveQuery(trimmed);
  }

  function clearSearch() {
    setActiveQuery(null);
    setQuery("");
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

  return (
    <div className="min-h-screen">
      <UploadRoomModal open={modalOpen} onOpenChange={setModalOpen} productId={modalProductId} />

      <section className="px-6 py-8 sm:py-14 md:py-20 bg-gradient-to-b from-[var(--color-indigo-50)]/60 to-transparent">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6 md:gap-10 lg:gap-14 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 text-balance leading-tight">
              See it on your wall before you buy.
            </h1>
            <p className="text-gray-600 text-base sm:text-lg mt-3 max-w-md">
              Tell us what you&apos;re picturing, or browse below.
            </p>

            <form onSubmit={handleIntentSubmit} className="mt-6 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white pl-4 pr-1.5 py-1.5 max-w-md shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-400">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. "warm and elegant living room"'
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

            <button type="button" onClick={() => openUpload()} className="mt-3 text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2">
              Upload your room
            </button>
          </div>
          <div className="relative rounded-[20px] bg-white/60 border border-gray-200 p-3 md:p-4 h-32 md:h-auto overflow-hidden">
            <svg preserveAspectRatio="xMidYMid slice" viewBox="0 0 420 300" xmlns="http://www.w3.org/2000/svg" className="w-full h-full md:h-auto rounded-2xl">
              <rect width="420" height="300" fill="#f6f1e6" />
              <rect width="420" height="46" fill="#fbf8f1" />
              <polygon points="0,46 250,46 220,260 0,260" fill="#c9d6c0" />
              <polygon points="250,46 420,46 420,260 220,260" fill="#6f8a5e" />
              <line x1="250" y1="46" x2="220" y2="260" stroke="#4a5f3f" strokeWidth="2" />
              <rect x="0" y="260" width="420" height="40" fill="#a98863" />
              <rect x="40" y="150" width="70" height="90" fill="#4a3728" />
            </svg>
            <div className="absolute bottom-2.5 right-2.5 md:bottom-6 md:right-6 bg-white rounded-xl md:rounded-2xl shadow-lg p-1.5 md:p-3 flex items-center gap-1.5 md:gap-2.5">
              <span className="h-6 w-6 md:h-9 md:w-9 rounded-lg block shrink-0" style={{ backgroundColor: "#6f8a5e" }} />
              <p className="text-[10px] md:text-xs font-semibold text-gray-900 leading-tight pr-1">Botanical Leaf</p>
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
                {hasConfidentMatches ? "Pick one to see it on your wall." : "Here's the full catalogue instead."}
              </p>
            </div>
            <button type="button" onClick={clearSearch} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0">
              Clear search
            </button>
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-gray-900 text-center">Browse materials</h2>
        )}

        {hasConfidentMatches ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {matched.map((p) => (
              <MaterialProductCard key={p.id} p={p} onOpen={() => openUpload(p.id)} />
            ))}
          </div>
        ) : (
          <MaterialBrowseSection products={products} subtypesByCategory={subtypesByCategory} onOpenProduct={openUpload} />
        )}
      </section>
    </div>
  );
}

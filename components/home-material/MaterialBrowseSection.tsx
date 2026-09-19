"use client";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogFilterBar } from "@/components/catalog/CatalogFilterBar";
import { MaterialProductCard, CATEGORY_LABELS, CATEGORY_ORDER } from "@/components/home-material/MaterialProductCard";
import type { BrowseProduct } from "@/lib/home-material/browse-product";
import type { SubtypeOption } from "@/app/materials/page";

const ALL = "All";
const LABEL_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([key, label]) => [label, key])
);

/**
 * The "already know what you want?" browse experience underneath the
 * intent hero — deliberately built to the same information architecture
 * as /shop (2026-09-14, user-requested parity): CatalogFilterBar for
 * search + a price/material-type filter (the same shared component
 * /shop uses, occasion/location hidden since they don't apply here),
 * subtype chips for the selected material type ordered by popularity
 * (see app/materials/page.tsx's getSubtypesByCategory), and the same
 * responsive grid (2 columns on mobile, up to 5 on wide screens) with
 * MaterialProductCard mirroring ShopProductCard's visual language.
 *
 * Everything here filters an already-fetched, small (pre-launch-scale)
 * product array entirely client-side — unlike /shop's paginated
 * `/api/public/products`, a new paginated endpoint isn't justified yet
 * for a catalogue this size (CLAUDE.md §17, avoid designing for scale
 * that doesn't exist). Revisit if the catalogue grows enough that a
 * full client-side array becomes wasteful to ship on every load.
 */
export function MaterialBrowseSection({
  products,
  subtypesByCategory,
  onOpenProduct,
}: {
  products: BrowseProduct[];
  subtypesByCategory: Record<string, SubtypeOption[]>;
  onOpenProduct: (productId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState(ALL);
  const [selectedSubtypeLabel, setSelectedSubtypeLabel] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const selectedCategoryKey = selectedCategoryLabel === ALL ? null : LABEL_TO_CATEGORY[selectedCategoryLabel] ?? null;
  const subtypeOptions = selectedCategoryKey ? subtypesByCategory[selectedCategoryKey] ?? [] : [];
  const selectedSubtype = subtypeOptions.find((s) => s.label === selectedSubtypeLabel)?.subtype ?? "";

  // Collection chips (2026-09-15) — a real HmProduct.collection field
  // (brand/line grouping) that no current seed product sets yet, so this
  // renders nothing until a product actually has one, same "don't show a
  // chip that leads to an empty grid" rule as subtypes. Scoped to
  // category+subtype (not price/search) so switching material type
  // doesn't show a collection with zero matches in it.
  const collectionOptions = useMemo(() => {
    const inScope = products.filter((p) => {
      if (selectedCategoryKey && p.category !== selectedCategoryKey) return false;
      if (selectedSubtype && p.subtype !== selectedSubtype) return false;
      return true;
    });
    return Array.from(new Set(inScope.map((p) => p.collection).filter((c): c is string => !!c))).sort((a, b) => a.localeCompare(b));
  }, [products, selectedCategoryKey, selectedSubtype]);

  function effectivePrice(p: BrowseProduct): number | null {
    return p.priceIsExact ? p.priceInr : p.costRangeMaxInr ?? p.priceInr;
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategoryKey && p.category !== selectedCategoryKey) return false;
      if (selectedSubtype && p.subtype !== selectedSubtype) return false;
      if (selectedCollection && p.collection !== selectedCollection) return false;
      if (priceMin > 0 || priceMax > 0) {
        const price = effectivePrice(p);
        if (price == null) return false;
        if (priceMin > 0 && price < priceMin) return false;
        if (priceMax > 0 && price > priceMax) return false;
      }
      if (q) {
        const haystack = [p.name, p.patternName, p.finish, CATEGORY_LABELS[p.category ?? ""]].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [products, selectedCategoryKey, selectedSubtype, selectedCollection, priceMin, priceMax, searchQuery]);

  const hasFilters =
    selectedCategoryLabel !== ALL || !!selectedSubtype || !!selectedCollection || priceMin > 0 || priceMax > 0 || searchQuery !== "";

  function resetFilters() {
    setSelectedCategoryLabel(ALL);
    setSelectedSubtypeLabel("");
    setSelectedCollection("");
    setPriceMin(0);
    setPriceMax(0);
    setSearchQuery("");
  }

  return (
    <div>
      <CatalogFilterBar
        categories={[ALL, ...CATEGORY_ORDER.map((c) => CATEGORY_LABELS[c])]}
        occasions={[]}
        hideOccasion
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategoryLabel}
        onCategoryChange={(label) => {
          setSelectedCategoryLabel(label === selectedCategoryLabel ? ALL : label);
          setSelectedSubtypeLabel("");
        }}
        selectedOccasion=""
        onOccasionChange={() => {}}
        subcategories={subtypeOptions.map((s) => s.label)}
        selectedSubcategory={selectedSubtypeLabel}
        onSubcategoryChange={setSelectedSubtypeLabel}
        priceMin={priceMin}
        onPriceMinChange={setPriceMin}
        priceMax={priceMax}
        onPriceMaxChange={setPriceMax}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        hasFilters={hasFilters}
        onReset={resetFilters}
      />

      {collectionOptions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mt-4 mb-6 scrollbar-hide">
          {collectionOptions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCollection(c === selectedCollection ? "" : c)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                selectedCollection === c
                  ? "bg-[var(--color-indigo-600)] text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 bg-[var(--color-indigo-50)] rounded-2xl flex items-center justify-center mb-4">
            <Sparkles className="h-7 w-7 text-[var(--color-indigo-400)]" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">No materials found</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            {hasFilters ? "Try adjusting your search or filters." : "Check back soon — retailers are adding new products."}
          </p>
          {hasFilters && <Button variant="secondary" onClick={resetFilters}>Reset filters</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((p) => (
            <MaterialProductCard key={p.id} p={p} onOpen={() => onOpenProduct(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

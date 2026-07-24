"use client";
import { useState } from "react";
import { Search, SlidersHorizontal, X, IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface CatalogFilterBarProps {
  categories: string[];
  occasions: string[];

  searchQuery: string;
  onSearchChange: (value: string) => void;

  selectedCategory: string;
  onCategoryChange: (value: string) => void;

  selectedOccasion: string;
  onOccasionChange: (value: string) => void;

  /** Only relevant when a caller supports these filters (e.g. voice search) — omit to hide their badges entirely. */
  selectedColor?: string;
  onClearColor?: () => void;
  selectedGender?: string;
  onClearGender?: () => void;

  /** Price range filter — products between min and max are shown in the primary window. */
  priceMin?: number;
  onPriceMinChange?: (value: number) => void;
  priceMax?: number;
  onPriceMaxChange?: (value: number) => void;

  filtersOpen: boolean;
  onToggleFilters: () => void;
  hasFilters: boolean;
  onReset: () => void;

  /** Rendered between the search input and the Filters toggle — e.g. a voice-search mic button. */
  searchBarExtra?: React.ReactNode;
  /** Rendered directly below the search row, above the category tabs — e.g. voice-search status banners. */
  belowSearchBar?: React.ReactNode;
}

/**
 * Search + category tabs + occasion filter + active-filter badges, shared by
 * the catalog and rental views. Extracted from CatalogView so both stay in
 * sync instead of drifting as two copies of the same markup.
 */
export function CatalogFilterBar({
  categories,
  occasions,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedOccasion,
  onOccasionChange,
  selectedColor,
  onClearColor,
  selectedGender,
  onClearGender,
  priceMin,
  onPriceMinChange,
  priceMax,
  onPriceMaxChange,
  filtersOpen,
  onToggleFilters,
  hasFilters,
  onReset,
  searchBarExtra,
  belowSearchBar,
}: CatalogFilterBarProps) {
  const priceMinStr = priceMin && priceMin > 0 ? String(priceMin) : "";
  const priceMaxStr = priceMax && priceMax > 0 ? String(priceMax) : "";
  const [localMin, setLocalMin] = useState(priceMinStr);
  const [localMax, setLocalMax] = useState(priceMaxStr);

  if (localMin !== priceMinStr && document.activeElement?.getAttribute("data-price") !== "min") {
    setLocalMin(priceMinStr);
  }
  if (localMax !== priceMaxStr && document.activeElement?.getAttribute("data-price") !== "max") {
    setLocalMax(priceMaxStr);
  }

  function commitPrice() {
    const min = parseInt(localMin) || 0;
    const max = parseInt(localMax) || 0;
    if (min !== (priceMin ?? 0)) onPriceMinChange?.(min);
    if (max !== (priceMax ?? 0)) onPriceMaxChange?.(max);
  }

  const hasPriceFilter = (priceMin ?? 0) > 0 || (priceMax ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search products, colors, materials..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            rightIcon={
              searchQuery ? (
                <button onClick={() => onSearchChange("")}>
                  <X className="h-4 w-4" />
                </button>
              ) : null
            }
          />
        </div>

        {searchBarExtra}

        <Button
          variant="outline"
          size="md"
          onClick={onToggleFilters}
          className={filtersOpen ? "border-indigo-300 bg-indigo-50 text-indigo-600" : ""}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasFilters && <span className="h-2 w-2 bg-indigo-500 rounded-full" />}
        </Button>
      </div>

      {belowSearchBar}

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              selectedCategory === cat
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expanded filters */}
      {filtersOpen && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-700">Occasion</span>
              {selectedOccasion && (
                <button onClick={() => onOccasionChange("")} className="text-xs text-gray-400 hover:text-gray-600">
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {occasions.map((occ) => (
                <button
                  key={occ}
                  onClick={() => onOccasionChange(occ === selectedOccasion ? "" : occ)}
                  className={`px-3 py-1 rounded-full text-sm border transition-all ${
                    selectedOccasion === occ
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {occ}
                </button>
              ))}
            </div>
          </div>

          {onPriceMinChange && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <IndianRupee className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Price Range</span>
                {hasPriceFilter && (
                  <button onClick={() => { onPriceMinChange(0); onPriceMaxChange?.(0); }} className="text-xs text-gray-400 hover:text-gray-600">
                    Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">&#8377;</span>
                  <input
                    type="number"
                    data-price="min"
                    placeholder="Min"
                    value={localMin}
                    onChange={(e) => setLocalMin(e.target.value)}
                    onBlur={commitPrice}
                    onKeyDown={(e) => { if (e.key === "Enter") commitPrice(); }}
                    min={0}
                    className="w-28 pl-7 pr-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <span className="text-xs text-gray-400">to</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">&#8377;</span>
                  <input
                    type="number"
                    data-price="max"
                    placeholder="Max"
                    value={localMax}
                    onChange={(e) => setLocalMax(e.target.value)}
                    onBlur={commitPrice}
                    onKeyDown={(e) => { if (e.key === "Enter") commitPrice(); }}
                    min={0}
                    className="w-28 pl-7 pr-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active filter badges */}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Active:</span>
          {selectedCategory !== "All" && (
            <Badge variant="purple" className="gap-1">
              {selectedCategory}
              <button onClick={() => onCategoryChange("All")}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {selectedOccasion && (
            <Badge variant="info" className="gap-1">
              {selectedOccasion}
              <button onClick={() => onOccasionChange("")}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {selectedColor && onClearColor && (
            <Badge variant="default" className="gap-1 capitalize">
              {selectedColor}
              <button onClick={onClearColor}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {selectedGender && onClearGender && (
            <Badge variant="outline" className="gap-1 capitalize">
              {selectedGender.toLowerCase()}
              <button onClick={onClearGender}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {hasPriceFilter && onPriceMinChange && (
            <Badge variant="purple" className="gap-1">
              {(priceMin ?? 0) > 0 && (priceMax ?? 0) > 0
                ? `${formatCurrency(priceMin!)} – ${formatCurrency(priceMax!)}`
                : (priceMin ?? 0) > 0
                ? `${formatCurrency(priceMin!)}+`
                : `Up to ${formatCurrency(priceMax!)}`}
              <button onClick={() => { onPriceMinChange(0); onPriceMaxChange?.(0); }}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="default" className="gap-1">
              &quot;{searchQuery}&quot;
              <button onClick={() => onSearchChange("")}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-600 underline">
            Reset all
          </button>
        </div>
      )}
    </div>
  );
}

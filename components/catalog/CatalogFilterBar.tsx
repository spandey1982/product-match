"use client";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  filtersOpen,
  onToggleFilters,
  hasFilters,
  onReset,
  searchBarExtra,
  belowSearchBar,
}: CatalogFilterBarProps) {
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
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
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

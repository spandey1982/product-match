"use client";
import { useState, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { Pagination } from "@/types";
import { PublicRentalProduct } from "@/lib/rental/public-product";
import { RentalProductCard } from "@/components/rental/RentalProductCard";
import { CatalogFilterBar } from "@/components/catalog/CatalogFilterBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES, OCCASIONS } from "@/lib/catalog/taxonomy";

/**
 * Public rental marketplace — spans every retailer's active catalog via the
 * unauthenticated /api/public/rental-products endpoints. Reuses the same
 * CatalogFilterBar and grid layout as CatalogView/the old retailer-only
 * RentalView, swapping only the data source.
 */
export function RentalView() {
  const [products, setProducts] = useState<PublicRentalProduct[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedOccasion, setSelectedOccasion] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "All") params.set("category", selectedCategory);
      if (selectedOccasion) params.set("occasion", selectedOccasion);
      params.set("page", String(page));
      params.set("limit", "24");
      const res = await fetch(`/api/public/rental-products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedOccasion, page]);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { fetchProducts(); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/public/rental-products/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setProducts(data.products || []);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [fetchProducts]);

  useEffect(() => {
    setTimeout(() => { if (!searchQuery) void fetchProducts(); }, 0);
  }, [fetchProducts, searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery) searchProducts(searchQuery); }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, searchProducts]);

  function resetFilters() {
    setSelectedCategory("All");
    setSelectedOccasion("");
    setPage(1);
    setSearchQuery("");
  }

  const hasFilters = selectedCategory !== "All" || selectedOccasion !== "" || searchQuery !== "";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900">Rent</h1>
      </div>

      <CatalogFilterBar
        categories={CATEGORIES}
        occasions={OCCASIONS}
        searchQuery={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
        selectedCategory={selectedCategory}
        onCategoryChange={(cat) => { setSelectedCategory(cat); setPage(1); setSearchQuery(""); }}
        selectedOccasion={selectedOccasion}
        onOccasionChange={(occ) => { setSelectedOccasion(occ); setPage(1); }}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        hasFilters={hasFilters}
        onReset={resetFilters}
      />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/5]" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No items found</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            {hasFilters
              ? "Try adjusting your filters or search query"
              : "Check back soon — retailers are adding items for rent"}
          </p>
          {hasFilters && (
            <Button variant="secondary" onClick={resetFilters}>Reset filters</Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product) => (
              <RentalProductCard key={product.id} product={product} />
            ))}
          </div>

          {pagination && pagination.pages > 1 && !searchQuery && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

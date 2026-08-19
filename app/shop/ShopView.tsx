"use client";
import { useState, useEffect, useCallback } from "react";
import { Sparkles, MapPin } from "lucide-react";
import { Pagination } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { PublicShopProduct } from "@/lib/shop/public-product";
import { ShopProductCard } from "@/components/shop/ShopProductCard";
import { CatalogFilterBar } from "@/components/catalog/CatalogFilterBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES, OCCASIONS } from "@/lib/catalog/taxonomy";
import { CITY_NAMES } from "@/lib/geo/city-coordinates";

interface ShopViewProps {
  loggedIn: boolean;
  /** Product ids already on this customer's wishlist — empty for a guest. */
  wishlistedIds: string[];
}

type LocationSource = "city" | "geolocation" | null;

export function ShopView({ loggedIn, wishlistedIds }: ShopViewProps) {
  const [products, setProducts] = useState<PublicShopProduct[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedOccasion, setSelectedOccasion] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);

  const [selectedCity, setSelectedCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>(null);
  const [radiusKm, setRadiusKm] = useState(0);
  const [locationError, setLocationError] = useState("");

  const wishlistedSet = new Set(wishlistedIds);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "All") params.set("category", selectedCategory);
      if (selectedOccasion) params.set("occasion", selectedOccasion);
      if (selectedSubcategory) params.set("subcategory", selectedSubcategory);
      if (priceMin > 0) params.set("priceMin", String(priceMin));
      if (locationSource === "geolocation" && coords) {
        params.set("lat", String(coords.lat));
        params.set("lng", String(coords.lng));
      } else if (selectedCity) {
        params.set("city", selectedCity);
      }
      params.set("page", String(page));
      params.set("limit", "24");
      const res = await fetch(`/api/public/products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setSubcategories(data.subcategories || []);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedOccasion, selectedSubcategory, priceMin, selectedCity, locationSource, coords, page]);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { fetchProducts(); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/public/products/search?q=${encodeURIComponent(q)}`);
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
    setSelectedSubcategory("");
    setPriceMin(0);
    setPriceMax(0);
    setSelectedCity("");
    setCoords(null);
    setLocationSource(null);
    setRadiusKm(0);
    setPage(1);
    setSearchQuery("");
  }

  function handleUseMyLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location — pick your city instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationSource("geolocation");
        setSelectedCity("");
        setPage(1);
      },
      () => setLocationError("Couldn't get your location — pick your city instead."),
      { timeout: 8000 }
    );
  }

  function handleCityChange(city: string) {
    setSelectedCity(city);
    setCoords(null);
    setLocationSource(city ? "city" : null);
    setPage(1);
  }

  const hasFilters =
    selectedCategory !== "All" ||
    selectedOccasion !== "" ||
    selectedSubcategory !== "" ||
    searchQuery !== "" ||
    priceMin > 0 ||
    priceMax > 0 ||
    radiusKm > 0;

  const hasPriceWindow = priceMax > 0;
  function splitByPrice(list: PublicShopProduct[]) {
    if (!hasPriceWindow) return { within: list, above: [] as PublicShopProduct[] };
    return {
      within: list.filter((p) => p.price <= priceMax),
      above: list.filter((p) => p.price > priceMax),
    };
  }

  const hasLocation = locationSource !== null && (coords !== null || selectedCity !== "");
  const radiusActive = radiusKm > 0 && hasLocation;

  let withinRadius: PublicShopProduct[] = [];
  let beyondRadius: PublicShopProduct[] = [];
  if (radiusActive) {
    withinRadius = products
      .filter((p) => p.distanceKm !== null && p.distanceKm <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    beyondRadius = products.filter((p) => p.distanceKm === null || p.distanceKm > radiusKm);
  }

  function renderGrid(list: PublicShopProduct[]) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {list.map((product) => (
          <ShopProductCard
            key={product.id}
            product={product}
            initialWishlisted={wishlistedSet.has(product.id)}
            loggedIn={loggedIn}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <CatalogFilterBar
        categories={CATEGORIES}
        occasions={OCCASIONS}
        searchQuery={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
        selectedCategory={selectedCategory}
        onCategoryChange={(cat) => {
          setSelectedCategory(cat);
          setSelectedSubcategory("");
          setPage(1);
          setSearchQuery("");
        }}
        selectedOccasion={selectedOccasion}
        onOccasionChange={(occ) => { setSelectedOccasion(occ); setPage(1); }}
        subcategories={subcategories}
        selectedSubcategory={selectedSubcategory}
        onSubcategoryChange={(sub) => { setSelectedSubcategory(sub); setPage(1); }}
        priceMin={priceMin}
        onPriceMinChange={(v) => { setPriceMin(v); setPage(1); }}
        priceMax={priceMax}
        onPriceMaxChange={(v) => { setPriceMax(v); setPage(1); }}
        cityOptions={CITY_NAMES}
        selectedCity={selectedCity}
        onCityChange={handleCityChange}
        radiusKm={radiusKm}
        onRadiusChange={(v) => { setRadiusKm(v); setPage(1); }}
        onUseMyLocation={handleUseMyLocation}
        locationSource={locationSource}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        hasFilters={hasFilters}
        onReset={resetFilters}
        belowSearchBar={
          locationError ? <p className="text-xs text-amber-600">{locationError}</p> : undefined
        }
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
              : "Check back soon — retailers are adding new products"}
          </p>
          {hasFilters && (
            <Button variant="secondary" onClick={resetFilters}>Reset filters</Button>
          )}
        </div>
      ) : radiusActive ? (
        <>
          {withinRadius.length > 0 ? (
            <>
              {(() => {
                const { within, above } = splitByPrice(withinRadius);
                return (
                  <>
                    {renderGrid(within)}
                    {above.length > 0 && (
                      <>
                        <div className="flex items-center gap-3 my-6">
                          <div className="h-px flex-1 bg-gray-100" />
                          <p className="text-xs text-gray-400 shrink-0">
                            Now showing products with price above {formatCurrency(priceMax)}
                          </p>
                          <div className="h-px flex-1 bg-gray-100" />
                        </div>
                        {renderGrid(above)}
                      </>
                    )}
                  </>
                );
              })()}
              {beyondRadius.length > 0 && (
                <>
                  <div className="flex items-center gap-3 my-6">
                    <div className="h-px flex-1 bg-gray-100" />
                    <p className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Now showing products from stores beyond your selected {radiusKm} km radius
                    </p>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  {renderGrid(beyondRadius)}
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-700">
                <MapPin className="h-4 w-4 shrink-0" />
                No matching products found within {radiusKm} km — showing results from stores beyond this radius.
              </div>
              {(() => {
                const { within, above } = splitByPrice(beyondRadius);
                return (
                  <>
                    {renderGrid(within)}
                    {above.length > 0 && (
                      <>
                        <div className="flex items-center gap-3 my-6">
                          <div className="h-px flex-1 bg-gray-100" />
                          <p className="text-xs text-gray-400 shrink-0">
                            Now showing products with price above {formatCurrency(priceMax)}
                          </p>
                          <div className="h-px flex-1 bg-gray-100" />
                        </div>
                        {renderGrid(above)}
                      </>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </>
      ) : (
        (() => {
          const { within, above } = splitByPrice(products);
          return (
            <>
              {renderGrid(within)}
              {above.length > 0 && (
                <>
                  <div className="flex items-center gap-3 my-6">
                    <div className="h-px flex-1 bg-gray-100" />
                    <p className="text-xs text-gray-400 shrink-0">
                      Now showing products with price above {formatCurrency(priceMax)}
                    </p>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  {renderGrid(above)}
                </>
              )}
            </>
          );
        })()
      )}

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
    </div>
  );
}

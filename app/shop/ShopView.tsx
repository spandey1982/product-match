"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Sparkles, MapPin, ArrowLeft, FolderPlus, Check, X, Loader2, Copy, ExternalLink } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PublicShopProduct } from "@/lib/shop/public-product";
import { ShopProductCard } from "@/components/shop/ShopProductCard";
import { CatalogFilterBar } from "@/components/catalog/CatalogFilterBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CATEGORIES, OCCASIONS } from "@/lib/catalog/taxonomy";
import { CITY_NAMES } from "@/lib/geo/city-coordinates";

interface ShopViewProps {
  loggedIn: boolean;
  /** Product ids already on this customer's wishlist — empty for a guest. */
  wishlistedIds: string[];
  /** True only for an admin-session browsing the full /shop catalogue — gates the collection-builder UI. Never true on a collection screen. */
  isAdmin?: boolean;
  /** Present when rendering an admin-curated collection screen (/shop/collections/[id]) — scopes every fetch to that collection's product set. */
  collectionId?: string;
  collectionName?: string;
}

type LocationSource = "city" | "geolocation" | null;

export function ShopView({ loggedIn, wishlistedIds, isAdmin, collectionId, collectionName }: ShopViewProps) {
  const [products, setProducts] = useState<PublicShopProduct[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  // ── admin collection builder (only when isAdmin && !collectionId) ─────────
  const [collectMode, setCollectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [collectionNameInput, setCollectionNameInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdLink, setCreatedLink] = useState<{ id: string; name: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const canBuildCollections = Boolean(isAdmin) && !collectionId;

  function enterCollectMode() {
    setCollectMode(true);
    setSelectedIds(new Set());
  }

  function exitCollectMode() {
    setCollectMode(false);
    setSelectedIds(new Set());
  }

  function toggleProductSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelectedIds(new Set(products.map((p) => p.id)));
  }

  async function handleCreateCollection() {
    if (!collectionNameInput.trim() || selectedIds.size === 0) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/admin/shop-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: collectionNameInput.trim(), productIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Couldn't create the collection.");
        return;
      }
      setCreatedLink({ id: data.collection.id, name: data.collection.name });
      setNameDialogOpen(false);
      setCollectionNameInput("");
      exitCollectMode();
    } catch {
      setCreateError("Couldn't create the collection.");
    } finally {
      setCreating(false);
    }
  }

  function collectionLinkUrl(id: string) {
    return typeof window !== "undefined" ? `${window.location.origin}/shop/collections/${id}` : `/shop/collections/${id}`;
  }

  async function copyCollectionLink(id: string) {
    await navigator.clipboard.writeText(collectionLinkUrl(id));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const wishlistedSet = new Set(wishlistedIds);

  const fetchProducts = useCallback(async () => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
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
      if (collectionId) params.set("collectionId", collectionId);
      params.set("page", String(page));
      params.set("limit", "24");
      const res = await fetch(`/api/public/products?${params}`);
      const data = await res.json();
      const fetched: PublicShopProduct[] = data.products || [];
      setProducts((prev) => (page === 1 ? fetched : [...prev, ...fetched]));
      setSubcategories(data.subcategories || []);
      setHasMore(data.pagination ? data.pagination.page < data.pagination.pages : false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCategory, selectedOccasion, selectedSubcategory, priceMin, selectedCity, locationSource, coords, page, collectionId]);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { fetchProducts(); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (collectionId) params.set("collectionId", collectionId);
      const res = await fetch(`/api/public/products/search?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchProducts, collectionId]);

  useEffect(() => {
    setTimeout(() => { if (!searchQuery) void fetchProducts(); }, 0);
  }, [fetchProducts, searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery) searchProducts(searchQuery); }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, searchProducts]);

  // ── infinite scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || loading || loadingMore || !hasMore || searchQuery) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setPage((p) => p + 1); },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, searchQuery]);

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
        {list.map((product) =>
          collectMode ? (
            <div key={product.id} className="relative cursor-pointer" onClick={() => toggleProductSelection(product.id)}>
              <div className={cn("rounded-2xl transition-all pointer-events-none", selectedIds.has(product.id) && "ring-2 ring-indigo-500 ring-offset-2")}>
                <ShopProductCard product={product} initialWishlisted={wishlistedSet.has(product.id)} loggedIn={loggedIn} />
              </div>
              <div className={cn(
                "absolute top-2.5 left-2.5 z-30 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all",
                selectedIds.has(product.id)
                  ? "bg-indigo-600 border-indigo-600"
                  : "bg-white/80 border-gray-300 backdrop-blur-sm"
              )}>
                {selectedIds.has(product.id) && <Check className="h-3.5 w-3.5 text-white" />}
              </div>
            </div>
          ) : (
            <ShopProductCard
              key={product.id}
              product={product}
              initialWishlisted={wishlistedSet.has(product.id)}
              loggedIn={loggedIn}
            />
          )
        )}
      </div>
    );
  }

  return (
    <div>
      {collectionName && (
        <div className="mb-6">
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Shop
          </Link>
          <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900">{collectionName}</h1>
        </div>
      )}

      {canBuildCollections && !collectMode && (
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={enterCollectMode}>
            <FolderPlus className="h-4 w-4" />
            Create Collection
          </Button>
        </div>
      )}

      {collectMode && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
          <FolderPlus className="h-4 w-4 text-indigo-500 shrink-0" />
          <p className="text-sm text-indigo-800 flex-1">
            {selectedIds.size === 0
              ? "Tap products to add them to a collection"
              : <><span className="font-semibold">{selectedIds.size}</span> selected</>}
          </p>
          <button
            onClick={selectAllOnPage}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2 shrink-0"
          >
            Select all on page
          </button>
          <button
            onClick={() => setNameDialogOpen(true)}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
          >
            Create Collection
          </button>
          <button onClick={exitCollectMode} className="text-indigo-400 hover:text-indigo-600 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Dialog open={nameDialogOpen} onOpenChange={(open) => { if (!creating) { setNameDialogOpen(open); if (!open) setCreateError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name this collection</DialogTitle>
            <DialogDescription>{selectedIds.size} product{selectedIds.size === 1 ? "" : "s"} selected. A public link is generated automatically once created.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="e.g. Diwali Edit 2026"
            value={collectionNameInput}
            onChange={(e) => setCollectionNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateCollection(); }}
          />
          {createError && <p className="text-xs text-red-600 mt-2">{createError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNameDialogOpen(false)} disabled={creating}>Cancel</Button>
            <Button size="sm" onClick={handleCreateCollection} disabled={creating || !collectionNameInput.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdLink} onOpenChange={(open) => { if (!open) setCreatedLink(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collection created</DialogTitle>
            <DialogDescription>&ldquo;{createdLink?.name}&rdquo; is live at this public link — anyone with it can view it.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-600 truncate flex-1">{createdLink ? collectionLinkUrl(createdLink.id) : ""}</span>
            <button
              onClick={() => createdLink && copyCollectionLink(createdLink.id)}
              className="shrink-0 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Copy className="h-3.5 w-3.5" />
              {linkCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreatedLink(null)}>Close</Button>
            {createdLink && (
              <Link href={`/shop/collections/${createdLink.id}`} target="_blank">
                <Button size="sm">
                  <ExternalLink className="h-4 w-4" />
                  View Collection
                </Button>
              </Link>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!collectionId && (
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
          hideSubcategoryTabs
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
      )}

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

      {hasMore && !searchQuery && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />}
        </div>
      )}
    </div>
  );
}

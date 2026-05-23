"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search, SlidersHorizontal, Package, Plus, X,
  Sparkles, Mic, Loader2, MicOff,
} from "lucide-react";
import { Product, Pagination } from "@/types";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = [
  "All", "Saree", "Lehenga", "Blouse", "Dupatta", "Kurta",
  "Anarkali", "Sharara", "Palazzo", "Jewellery", "Footwear", "Clutch", "Handbag",
];

const OCCASIONS = ["Wedding", "Festive", "Bridal", "Party", "Casual", "Formal"];

type VoiceState = "idle" | "listening" | "processing";

export function CatalogView() {
  // ── catalog state ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // ── filter state ───────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedOccasion, setSelectedOccasion] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── voice state ────────────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceInterpretation, setVoiceInterpretation] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<unknown>(null);

  // ── data fetching ──────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "All") params.set("category", selectedCategory);
      if (selectedOccasion) params.set("occasion", selectedOccasion);
      if (selectedColor)    params.set("color", selectedColor);
      if (selectedGender)   params.set("gender", selectedGender);
      params.set("page",  String(page));
      params.set("limit", "24");
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedOccasion, selectedColor, selectedGender, page]);

  const searchProducts = useCallback(
    async (q: string) => {
      if (!q.trim()) { fetchProducts(); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setProducts(data.products || []);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [fetchProducts]
  );

  useEffect(() => {
    if (!searchQuery) fetchProducts();
  }, [fetchProducts, searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery) searchProducts(searchQuery); }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, searchProducts]);

  // ── reset ──────────────────────────────────────────────────────────────────
  function resetFilters() {
    setSelectedCategory("All");
    setSelectedOccasion("");
    setSelectedColor("");
    setSelectedGender("");
    setPage(1);
    setSearchQuery("");
    setVoiceInterpretation("");
    setVoiceError("");
  }

  const hasFilters =
    selectedCategory !== "All" || selectedOccasion || searchQuery ||
    selectedColor || selectedGender;

  // ── voice search ───────────────────────────────────────────────────────────
  async function applyVoiceFilters(transcript: string) {
    setVoiceState("processing");
    setVoiceError("");
    try {
      const res = await fetch("/api/ai/voice-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();

      if (!res.ok) {
        setVoiceError(data.error || "Voice search failed");
        return;
      }

      const f = data.filters;
      // Apply every extracted filter; fall back to "All" / empty if null
      setSelectedCategory(f.category || "All");
      setSelectedColor(f.color || "");
      setSelectedOccasion(f.occasion || "");
      setSelectedGender(f.gender || "");
      setSearchQuery(f.searchQuery || "");
      setVoiceInterpretation(f.interpretation || transcript);
      setPage(1);
    } catch {
      setVoiceError("Could not reach voice search service.");
    } finally {
      setVoiceState("idle");
    }
  }

  function startVoiceSearch() {
    setVoiceError("");

    // Stop any in-progress recognition
    if (recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
      recognitionRef.current = null;
    }

    // Toggle off if already listening
    if (voiceState === "listening") {
      setVoiceState("idle");
      return;
    }

    const SpeechRecognitionAPI =
      (typeof window !== "undefined") &&
      ((window as unknown as Record<string, unknown>).SpeechRecognition ||
       (window as unknown as Record<string, unknown>).webkitSpeechRecognition);

    if (!SpeechRecognitionAPI) {
      setVoiceError("Voice search requires Chrome or Edge browser.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognitionAPI as any)();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setVoiceState("listening");

    recognition.onresult = (event: { results: { [n: number]: { [n: number]: { transcript: string } } } }) => {
      const transcript = event.results[0][0].transcript;
      recognitionRef.current = null;
      applyVoiceFilters(transcript);
    };

    recognition.onerror = (event: { error: string }) => {
      recognitionRef.current = null;
      setVoiceState("idle");
      if (event.error === "not-allowed") {
        setVoiceError("Microphone access denied. Allow it in browser settings.");
      } else if (event.error === "no-speech") {
        setVoiceError("No speech detected. Please try again.");
      } else {
        setVoiceError("Voice recognition failed. Please try again.");
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // only reset to idle if we didn't already move to "processing"
      setVoiceState((s) => (s === "listening" ? "idle" : s));
    };

    recognition.start();
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-500" />
            Catalog
          </h1>
          {pagination && (
            <p className="text-sm text-gray-500 mt-1">{pagination.total} products</p>
          )}
        </div>
        <div className="flex-1" />
        <Link href="/upload">
          <Button size="md" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Search + mic + filters */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex gap-2">
          {/* Search input */}
          <div className="flex-1">
            <Input
              placeholder="Search products, colors, materials..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              leftIcon={<Search className="h-4 w-4" />}
              rightIcon={
                searchQuery ? (
                  <button onClick={() => setSearchQuery("")}>
                    <X className="h-4 w-4" />
                  </button>
                ) : null
              }
            />
          </div>

          {/* Mic button */}
          <button
            type="button"
            onClick={startVoiceSearch}
            disabled={voiceState === "processing"}
            title={
              voiceState === "listening" ? "Stop listening" :
              voiceState === "processing" ? "Processing…" :
              "Voice search"
            }
            className={`
              relative flex items-center justify-center h-10 w-10 rounded-xl border transition-all duration-200 shrink-0
              ${voiceState === "listening"
                ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-200"
                : voiceState === "processing"
                ? "bg-indigo-50 border-indigo-200 text-indigo-400 cursor-wait"
                : "bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50"
              }
            `}
          >
            {voiceState === "processing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : voiceState === "listening" ? (
              <>
                {/* Pulse rings while listening */}
                <span className="absolute inset-0 rounded-xl animate-ping bg-red-400 opacity-30" />
                <MicOff className="h-4 w-4 relative z-10" />
              </>
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>

          {/* Filters toggle */}
          <Button
            variant="outline"
            size="md"
            onClick={() => setFiltersOpen((v) => !v)}
            className={filtersOpen ? "border-indigo-300 bg-indigo-50 text-indigo-600" : ""}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasFilters && <span className="h-2 w-2 bg-indigo-500 rounded-full" />}
          </Button>
        </div>

        {/* Voice status banners */}
        {voiceState === "listening" && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <p className="text-sm font-medium text-red-700">
              Listening… speak your search
            </p>
            <p className="text-xs text-red-500 ml-auto hidden sm:block">
              e.g. &quot;Show me red wedding sarees&quot;
            </p>
          </div>
        )}

        {voiceState === "processing" && (
          <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <Loader2 className="h-4 w-4 text-indigo-500 animate-spin shrink-0" />
            <p className="text-sm font-medium text-indigo-700">
              Understanding your request with Gemini…
            </p>
          </div>
        )}

        {voiceState === "idle" && voiceInterpretation && !voiceError && (
          <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <Mic className="h-4 w-4 text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-indigo-700 truncate">
                &ldquo;{voiceInterpretation}&rdquo;
              </p>
            </div>
            <button
              onClick={resetFilters}
              className="text-xs text-indigo-400 hover:text-indigo-600 underline underline-offset-2 shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {voiceError && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
            <MicOff className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">{voiceError}</p>
            <button
              onClick={() => setVoiceError("")}
              className="ml-auto text-amber-400 hover:text-amber-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setPage(1); setSearchQuery(""); setVoiceInterpretation(""); }}
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
                <button onClick={() => setSelectedOccasion("")} className="text-xs text-gray-400 hover:text-gray-600">
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ}
                  onClick={() => { setSelectedOccasion(occ === selectedOccasion ? "" : occ); setPage(1); }}
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
                <button onClick={() => setSelectedCategory("All")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {selectedOccasion && (
              <Badge variant="info" className="gap-1">
                {selectedOccasion}
                <button onClick={() => setSelectedOccasion("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {selectedColor && (
              <Badge variant="default" className="gap-1 capitalize">
                {selectedColor}
                <button onClick={() => setSelectedColor("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {selectedGender && (
              <Badge variant="outline" className="gap-1 capitalize">
                {selectedGender.toLowerCase()}
                <button onClick={() => setSelectedGender("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="default" className="gap-1">
                &quot;{searchQuery}&quot;
                <button onClick={() => setSearchQuery("")}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            <button
              onClick={resetFilters}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            {hasFilters
              ? "Try adjusting your filters or search query"
              : "Start by adding products to your catalog"}
          </p>
          {hasFilters ? (
            <Button variant="secondary" onClick={resetFilters}>Reset filters</Button>
          ) : (
            <Link href="/upload">
              <Button><Plus className="h-4 w-4" />Add first product</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
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

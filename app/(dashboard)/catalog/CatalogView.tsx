"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search, SlidersHorizontal, Package, Plus, X,
  Sparkles, Mic, Loader2, MicOff, AlertCircle, Trash2,
} from "lucide-react";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";
import { cn } from "@/lib/utils";
import { Product, Pagination } from "@/types";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrialRoom, TRYON_LIMIT } from "@/components/trial-room/TrialRoomProvider";
import { TrialRoomSetupModal } from "@/components/trial-room/TrialRoomSetupModal";

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

  // ── trial room ─────────────────────────────────────────────────────────────
  const { photo, isAtLimit, activeTryOnCount, clearAll, setupHintActive } = useTrialRoom();
  const [emptyToast, setEmptyToast] = useState(false);
  const emptyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  function showEmptyToast() {
    if (emptyToastTimer.current) clearTimeout(emptyToastTimer.current);
    setEmptyToast(true);
    emptyToastTimer.current = setTimeout(() => setEmptyToast(false), 5000);
  }

  function confirmEmptyRoom() {
    if (emptyToastTimer.current) clearTimeout(emptyToastTimer.current);
    setEmptyToast(false);
    clearAll();
  }

  function dismissEmptyToast() {
    if (emptyToastTimer.current) clearTimeout(emptyToastTimer.current);
    setEmptyToast(false);
  }

  useEffect(() => () => { if (emptyToastTimer.current) clearTimeout(emptyToastTimer.current); }, []);

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
    // Bottom padding so the last row / pagination clears the floating Trial
    // Room button (fixed bottom-right) — critical on narrow mobile layouts.
    <div className="pb-28 md:pb-8">
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

      {/* Try-on limit banner */}
      {isAtLimit && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            Try-on limit reached&nbsp;
            <span className="font-semibold">({activeTryOnCount}/{TRYON_LIMIT})</span>.
            {" "}Remove a try-on to add more.
          </p>
          <Link
            href="/my-try-ons"
            className="text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 shrink-0"
          >
            Manage Try-Ons
          </Link>
        </div>
      )}

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

      {/* ── Floating Trial Room button ── */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        {/* Contextual hint — shown when user taps Add-to-Trial-Room without a photo */}
        {setupHintActive && !photo && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-200 rounded-2xl shadow-lg text-sm text-indigo-800 max-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <HangerPlusIcon size={14} className="text-indigo-500 shrink-0" />
            <span>
              <strong>Set up Trial Room</strong> first — tap the button to upload a photo.
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Empty Trial Room — only visible once a session is active */}
          {photo && (
            <button
              onClick={showEmptyToast}
              className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-500 shadow-sm hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
              title="Empty Trial Room"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Empty Trial Room</span>
            </button>
          )}

          {/* Primary FAB */}
          {photo ? (
            <Link href="/my-try-ons">
              <button
                className={cn(
                  "relative flex items-center gap-2 h-12 px-5 rounded-2xl text-sm font-semibold text-white shadow-lg",
                  "bg-gradient-to-br from-indigo-500 to-purple-600",
                  "hover:opacity-90 active:scale-[0.97] transition-all"
                )}
              >
                <Sparkles className="h-4 w-4" />
                Check Try-Ons
                {activeTryOnCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-indigo-600 text-[9px] font-bold flex items-center justify-center leading-none shadow">
                    {activeTryOnCount}
                  </span>
                )}
              </button>
            </Link>
          ) : (
            <button
              onClick={() => setSetupModalOpen(true)}
              className={cn(
                "flex items-center gap-2 h-12 px-5 rounded-2xl text-sm font-semibold text-white shadow-lg",
                "bg-gradient-to-br from-indigo-500 to-purple-600",
                "hover:opacity-90 active:scale-[0.97] transition-all",
                setupHintActive && "animate-pulse ring-2 ring-offset-2 ring-indigo-400"
              )}
            >
              <HangerPlusIcon size={16} />
              Set Up Trial Room
            </button>
          )}
        </div>
      </div>

      {/* Empty Trial Room confirmation toast */}
      {emptyToast && (
        <div className="fixed bottom-24 inset-x-0 flex justify-center z-40 px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-sm w-full">
            <Trash2 className="h-4 w-4 text-red-400 shrink-0" />
            <p className="flex-1 text-sm font-medium">Clear all try-ons?</p>
            <button
              onClick={dismissEmptyToast}
              className="text-xs font-medium text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={confirmEmptyRoom}
              className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Trial Room setup modal */}
      {setupModalOpen && (
        <TrialRoomSetupModal onClose={() => setSetupModalOpen(false)} />
      )}
    </div>
  );
}

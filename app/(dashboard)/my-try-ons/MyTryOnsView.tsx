"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Camera,
  Loader2,
  Heart,
  Trash2,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Plus,
  Check,
} from "lucide-react";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { TryOnViewer } from "@/components/trial-room/TryOnViewer";
import { cn } from "@/lib/utils";
import type { TryOnEntry } from "@/lib/trial-room-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Try-On Card ──────────────────────────────────────────────────────────────

function TryOnCard({
  entry,
  onOpen,
}: {
  entry: TryOnEntry;
  onOpen?: () => void;
}) {
  const { retryTryOn, removeFromTryOns, addToWishlist, isInWishlist } =
    useTrialRoom();

  const wishlisted = isInWishlist(entry.id);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm group">
      {/* Image area */}
      <div className="relative aspect-[3/4] bg-gray-50">
        {entry.status === "done" && entry.resultUrl ? (
          <>
            {/* Clickable image — opens full-screen viewer */}
            <button
              onClick={onOpen}
              className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
              aria-label={`View full-screen try-on for ${entry.product.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.resultUrl}
                alt={`Try-on for ${entry.product.title}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                draggable={false}
              />
            </button>
            {/* Wishlist button — sits above the image, stops propagation */}
            <button
              onClick={(e) => { e.stopPropagation(); addToWishlist(entry.id); }}
              disabled={wishlisted}
              aria-label={wishlisted ? "Saved to wishlist" : "Save to wishlist"}
              className={cn(
                "absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all z-10",
                wishlisted
                  ? "bg-rose-500 shadow-md"
                  : "bg-white/80 backdrop-blur-sm shadow hover:bg-white opacity-0 group-hover:opacity-100"
              )}
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5",
                  wishlisted ? "text-white fill-white" : "text-gray-600"
                )}
              />
            </button>
            {/* "Tap to expand" hint on mobile */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-white whitespace-nowrap">
                Tap to expand
              </span>
            </div>
          </>
        ) : entry.status === "generating" ? (
          /* Loading skeleton */
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
            <div className="relative">
              <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600">Generating…</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Usually 10–20 sec
              </p>
            </div>
            {/* Pulsing placeholder lines */}
            <div className="w-full space-y-1.5 px-2">
              <div className="h-1.5 bg-gray-100 rounded animate-pulse" />
              <div className="h-1.5 bg-gray-100 rounded animate-pulse w-3/4 mx-auto" />
            </div>
          </div>
        ) : (
          /* Failed */
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
            <AlertCircle className="h-8 w-8 text-red-300" />
            <p className="text-xs text-center text-gray-500 leading-relaxed">
              {entry.errorMessage ?? "Generation failed"}
            </p>
            <button
              onClick={() => retryTryOn(entry.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 space-y-1.5">
        <p className="text-xs font-medium text-gray-800 truncate leading-tight">
          {entry.product.title}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-400">{timeAgo(entry.createdAt)}</p>
          <div className="flex items-center gap-1">
            {/* Wishlist toggle (compact, shown in footer too) */}
            {entry.status === "done" && (
              <button
                onClick={() => addToWishlist(entry.id)}
                disabled={wishlisted}
                aria-label={wishlisted ? "Saved" : "Save to wishlist"}
                className={cn(
                  "h-6 w-6 rounded-lg flex items-center justify-center transition-colors",
                  wishlisted
                    ? "bg-rose-50 text-rose-500 cursor-default"
                    : "text-gray-400 hover:text-rose-500 hover:bg-rose-50"
                )}
              >
                {wishlisted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Heart className="h-3 w-3" />
                )}
              </button>
            )}
            {/* Remove */}
            <button
              onClick={() => removeFromTryOns(entry.id)}
              aria-label="Remove try-on"
              className="h-6 w-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page view ────────────────────────────────────────────────────────────────

type FilterTab = "all" | "generating" | "saved";

interface ViewerState {
  /** Snapshot of completed entries at the time the viewer was opened. */
  entries: TryOnEntry[];
  /** Index within `entries` of the image that was clicked. */
  index: number;
}

export function MyTryOnsView() {
  const { photo, tryOns, wishlist, clearAll } = useTrialRoom();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  // All completed entries — the full set the viewer can navigate through.
  const doneEntries = tryOns.filter(
    (t): t is TryOnEntry & { resultUrl: string } =>
      t.status === "done" && !!t.resultUrl
  );

  function openViewer(entry: TryOnEntry) {
    const idx = doneEntries.findIndex((e) => e.id === entry.id);
    if (idx === -1) return;
    setViewer({ entries: [...doneEntries], index: idx });
  }

  const generatingCount = tryOns.filter(
    (t) => t.status === "generating"
  ).length;
  const savedCount = wishlist.length;

  const filtered =
    filter === "generating"
      ? tryOns.filter((t) => t.status === "generating")
      : filter === "saved"
      ? tryOns.filter((t) => wishlist.some((w) => w.tryOnId === t.id))
      : tryOns;

  function handleClearAll() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearAll();
    setConfirmClear(false);
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (tryOns.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            My Try-Ons
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Your virtual try-ons will appear here as they generate.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
          <Camera className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            No try-ons yet
          </p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto mb-5">
            {photo
              ? "Browse your catalog and click ‘Add for Virtual Try-On’ on any product."
              : "Start by uploading your photo in the Trial Room, then browse the catalog."}
          </p>
          <Link
            href={photo ? "/catalog" : "/trial-room"}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {photo ? "Browse Catalog" : "Set Up Trial Room"}
          </Link>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Full-screen viewer — rendered outside the grid so it can cover the
          entire viewport without being clipped by any ancestor overflow. */}
      {viewer && viewer.entries.length > 0 && (
        <TryOnViewer
          entries={viewer.entries}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            My Try-Ons
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tryOns.length} item{tryOns.length !== 1 ? "s" : ""}
            {generatingCount > 0 && (
              <span className="ml-1.5 text-indigo-500">
                · {generatingCount} generating
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/catalog"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add More
          </Link>
          <button
            onClick={handleClearAll}
            onBlur={() => setConfirmClear(false)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
              confirmClear
                ? "bg-red-600 text-white"
                : "border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50"
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmClear ? "Confirm clear" : "Clear all"}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-gray-100 rounded-xl w-fit">
        {(
          [
            { key: "all", label: `All (${tryOns.length})` },
            { key: "generating", label: `Processing (${generatingCount})` },
            { key: "saved", label: `Saved (${savedCount})` },
          ] as { key: FilterTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              filter === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">
          No items in this filter.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((entry) => (
            <TryOnCard
              key={entry.id}
              entry={entry}
              onOpen={
                entry.status === "done" ? () => openViewer(entry) : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Wishlist CTA */}
      {wishlist.length > 0 && (
        <div className="mt-8 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-800">
              Wishlist for In-Store Try-On
            </p>
            <p className="text-xs text-indigo-600 mt-0.5">
              {wishlist.length} item{wishlist.length !== 1 ? "s" : ""} saved
            </p>
          </div>
          <Link
            href="/wishlist"
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            View Wishlist →
          </Link>
        </div>
      )}
    </div>
  );
}

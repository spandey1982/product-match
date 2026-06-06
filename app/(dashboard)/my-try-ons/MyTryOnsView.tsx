"use client";

import { useRef, useState } from "react";
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
  UserCircle2,
  Lock,
  ImagePlus,
  X,
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

// ─── Customer Profile Panel ───────────────────────────────────────────────────
//
// Visible as soon as a photo is uploaded — even with zero try-ons.
// Photo replacement / removal are available until the first product is queued.

function CustomerProfile() {
  const {
    photoPreviewUrl,
    tryOns,
    wishlist,
    setPhoto,
    clearPhoto,
    isPhotoLocked,
  } = useTrialRoom();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const doneCount = tryOns.filter((t) => t.status === "done").length;
  const generatingCount = tryOns.filter((t) => t.status === "generating").length;

  // ── Photo replacement (only when not locked) ─────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Client-side validation (mirrors trial-room page)
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;

    setPhoto(file);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">

      {/* ── Customer photo ── */}
      <div className="relative bg-gray-100">
        {photoPreviewUrl ? (
          // object-contain: full photograph always visible without cropping
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreviewUrl}
            alt="Customer"
            className="w-full object-contain"
            style={{ maxHeight: "260px" }}
          />
        ) : (
          <div className="flex items-center justify-center h-40">
            <UserCircle2 className="h-12 w-12 text-gray-300" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2">
          {isPhotoLocked ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-600/80 backdrop-blur-sm text-white">
              <Lock className="h-2.5 w-2.5" />
              Session active
            </span>
          ) : (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-600/80 backdrop-blur-sm text-white">
              Photo ready
            </span>
          )}
        </div>

        {/* Change / remove photo overlay — only when not locked */}
        {!isPhotoLocked && photoPreviewUrl && (
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            {/* Change */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Change photo"
              aria-label="Change photo"
              className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 hover:bg-white transition-colors"
            >
              <ImagePlus className="h-3.5 w-3.5" />
            </button>
            {/* Remove */}
            <button
              onClick={() => clearPhoto()}
              title="Remove photo"
              aria-label="Remove photo"
              className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm shadow flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Hidden file input for photo replacement */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      {/* ── Session info ── */}
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Trial Room
          </p>

          {tryOns.length === 0 ? (
            <p className="text-xs text-gray-500">
              No try-ons yet.{" "}
              <Link href="/catalog" className="text-indigo-600 font-medium hover:underline">
                Browse catalog →
              </Link>
            </p>
          ) : (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-900">
                  {tryOns.length} try-on{tryOns.length !== 1 ? "s" : ""}
                </span>
                {generatingCount > 0 && (
                  <span className="text-xs text-indigo-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {generatingCount} generating
                  </span>
                )}
              </div>
              {doneCount > 0 && (
                <p className="text-xs text-emerald-600 font-medium">
                  {doneCount} ready to view
                </p>
              )}
              {wishlist.length > 0 && (
                <Link
                  href="/wishlist"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium block"
                >
                  {wishlist.length} saved to wishlist →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Session end is handled by "Empty Trial Room" in the catalog header */}
      </div>
    </div>
  );
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
      <div className="relative aspect-[3/4] bg-gray-50">
        {entry.status === "done" && entry.resultUrl ? (
          <>
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
              <Heart className={cn("h-3.5 w-3.5", wishlisted ? "text-white fill-white" : "text-gray-600")} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-white whitespace-nowrap">
                Tap to expand
              </span>
            </div>
          </>
        ) : entry.status === "generating" ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
            <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600">Generating…</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Usually 10–20 sec</p>
            </div>
            <div className="w-full space-y-1.5 px-2">
              <div className="h-1.5 bg-gray-100 rounded animate-pulse" />
              <div className="h-1.5 bg-gray-100 rounded animate-pulse w-3/4 mx-auto" />
            </div>
          </div>
        ) : (
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

      <div className="p-2.5 space-y-1.5">
        <p className="text-xs font-medium text-gray-800 truncate leading-tight">
          {entry.product.title}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-400">{timeAgo(entry.createdAt)}</p>
          <div className="flex items-center gap-1">
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
                {wishlisted ? <Check className="h-3 w-3" /> : <Heart className="h-3 w-3" />}
              </button>
            )}
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
  entries: TryOnEntry[];
  index: number;
}

export function MyTryOnsView() {
  const { photo, tryOns, wishlist } = useTrialRoom();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const generatingCount = tryOns.filter((t) => t.status === "generating").length;
  const savedCount = wishlist.length;

  const doneEntries = tryOns.filter(
    (t): t is TryOnEntry & { resultUrl: string } =>
      t.status === "done" && !!t.resultUrl
  );

  function openViewer(entry: TryOnEntry) {
    const idx = doneEntries.findIndex((e) => e.id === entry.id);
    if (idx === -1) return;
    setViewer({ entries: [...doneEntries], index: idx });
  }

  const filtered =
    filter === "generating"
      ? tryOns.filter((t) => t.status === "generating")
      : filter === "saved"
      ? tryOns.filter((t) => wishlist.some((w) => w.tryOnId === t.id))
      : tryOns;

  // ── No photo: prompt to set up trial room ─────────────────────────────────
  //
  // This is the ONLY condition that hides the profile panel. Once a photo
  // is uploaded (photo !== null), the two-column layout renders immediately —
  // even before any products are added.
  if (!photo) {
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
          <p className="text-sm font-medium text-gray-700 mb-1">No customer photo yet</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto mb-5">
            Set up the Trial Room by uploading a customer photograph, then browse the catalog to begin.
          </p>
          <Link
            href="/trial-room"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Set Up Trial Room
          </Link>
        </div>
      </div>
    );
  }

  // ── Photo exists: always show two-column layout ───────────────────────────
  //
  // CustomerProfile appears on the left as soon as photo !== null.
  // The right column shows the try-ons grid (or a "browse catalog" prompt
  // if no products have been added yet).
  return (
    <>
      {/* Full-screen viewer */}
      {viewer && viewer.entries.length > 0 && (
        <TryOnViewer
          entries={viewer.entries}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}

      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* ── LEFT: Customer profile panel ── */}
        <div className="w-full md:w-44 lg:w-52 shrink-0">
          <CustomerProfile />
        </div>

        {/* ── RIGHT: Try-ons content ── */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-indigo-500" />
                My Try-Ons
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {tryOns.length > 0
                  ? `${tryOns.length} item${tryOns.length !== 1 ? "s" : ""}${generatingCount > 0 ? ` · ${generatingCount} generating` : ""}`
                  : "Add products from the catalog to start"}
              </p>
            </div>
            <Link
              href="/catalog"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {tryOns.length === 0 ? "Browse Catalog" : "Add More"}
            </Link>
          </div>

          {/* No try-ons yet — prompt within the right column */}
          {tryOns.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-sm">
              <Camera className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">No try-ons yet</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto mb-5">
                Tap the hanger icon on any product in the catalog to add it for try-on.
              </p>
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Browse Catalog
              </Link>
            </div>
          ) : (
            <>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filtered.map((entry) => (
                    <TryOnCard
                      key={entry.id}
                      entry={entry}
                      onOpen={entry.status === "done" ? () => openViewer(entry) : undefined}
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
            </>
          )}
        </div>
      </div>
    </>
  );
}

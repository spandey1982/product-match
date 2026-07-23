"use client";

import Link from "next/link";
import {
  Heart,
  Trash2,
  ExternalLink,
  ShoppingBag,
  Plus,
  Printer,
} from "lucide-react";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { cn } from "@/lib/utils";
import type { WishlistEntry } from "@/lib/trial-room-types";

// ─── Wishlist Card ────────────────────────────────────────────────────────────

function WishlistCard({ entry }: { entry: WishlistEntry }) {
  const { removeFromWishlist } = useTrialRoom();

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex gap-0">
      {/* Try-on image thumbnail */}
      <div className="w-20 shrink-0 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.resultUrl}
          alt={`Try-on for ${entry.product.title}`}
          className="w-full h-full object-cover"
          style={{ minHeight: "80px" }}
        />
      </div>

      {/* Details */}
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
            {entry.product.title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 capitalize">
              {entry.product.category}
            </span>
            {entry.product.color && (
              <span className="text-xs text-gray-400">· {entry.product.color}</span>
            )}
            {entry.product.price > 0 && (
              <span className="text-xs font-medium text-gray-700">
                ₹{entry.product.price.toLocaleString("en-IN")}
              </span>
            )}
          </div>
          {entry.product.sku && (
            <p className="text-[10px] text-gray-400 font-mono">
              SKU: {entry.product.sku}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Link
            href={`/products/${entry.product.id}`}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            View details
            <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            onClick={() => removeFromWishlist(entry.id)}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── In-Store Print View ──────────────────────────────────────────────────────

function InStoreModal({
  entries,
  onClose,
}: {
  entries: WishlistEntry[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="text-center">
          <h2 className="text-base font-bold text-gray-900">
            In-Store Try-On List
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Show this list to store staff to locate items.
          </p>
        </div>

        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl"
            >
              <span className="text-xs font-bold text-gray-400 w-4 shrink-0">
                {i + 1}.
              </span>
              <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.resultUrl}
                  alt={entry.product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {entry.product.title}
                </p>
                <p className="text-[10px] text-gray-500 capitalize">
                  {entry.product.category}
                  {entry.product.color ? ` · ${entry.product.color}` : ""}
                  {entry.product.price
                    ? ` · ₹${entry.product.price.toLocaleString("en-IN")}`
                    : ""}
                </p>
                {entry.product.sku && (
                  <p className="text-[10px] font-mono text-gray-400">
                    {entry.product.sku}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page view ────────────────────────────────────────────────────────────────

import { useState } from "react";

export function WishlistView() {
  const { wishlist } = useTrialRoom();
  const [showInStore, setShowInStore] = useState(false);

  // ── Empty state ────────────────────────────────────────────────────────
  if (wishlist.length === 0) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-400" />
            Wishlist
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Save your favourite try-ons to shortlist for in-store trials.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
          <Heart className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            No items saved yet
          </p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto mb-5">
            Generate try-ons and tap the heart icon to save your favourites here.
          </p>
          <Link
            href="/trial-room"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            View Try-Ons
          </Link>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────
  return (
    <>
      {showInStore && (
        <InStoreModal
          entries={wishlist}
          onClose={() => setShowInStore(false)}
        />
      )}

      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Heart className="h-6 w-6 text-rose-400" />
              Wishlist
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {wishlist.length} item{wishlist.length !== 1 ? "s" : ""} saved
            </p>
          </div>
          <Link
            href="/trial-room"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add More
          </Link>
        </div>

        {/* List */}
        <div className="space-y-2">
          {wishlist.map((entry) => (
            <WishlistCard key={entry.id} entry={entry} />
          ))}
        </div>

        {/* In-store CTA */}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => setShowInStore(true)}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl",
              "text-sm font-semibold text-white",
              "bg-gradient-to-r from-indigo-500 to-purple-600",
              "shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
            )}
          >
            <ShoppingBag className="h-4 w-4" />
            View Wishlist for In-Store Try-On ({wishlist.length})
          </button>
          <p className="text-center text-[11px] text-gray-400">
            Show this list to store staff to locate your selected items.
          </p>
        </div>
      </div>
    </>
  );
}

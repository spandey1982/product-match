"use client";

import { useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  Heart,
  Check,
  Undo2,
  Layers,
  AlertCircle,
} from "lucide-react";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { ProductImage } from "@/components/product/ProductImage";
import { LookBuilder } from "@/components/look-builder/LookBuilder";

/**
 * Look Studio — the nested try-on workspace.
 *
 * Opens when a look session is active (started from a completed try-on). Shows
 * the running composite, lets the user layer coordinated pieces onto it (each
 * via nested try-on), and save the finished look for comparison in the wishlist.
 * Renders nothing when there is no active look, so it can be mounted globally.
 */
export function LookStudio() {
  const {
    lookSession,
    currentLookImage,
    isAddingToLook,
    addToLook,
    removeLastLookItem,
    cancelLook,
    saveLook,
  } = useTrialRoom();

  const [saved, setSaved] = useState(false);

  if (!lookSession) return null;

  const pieces = [lookSession.anchorProduct, ...lookSession.items.map((i) => i.product)];
  const isError = lookSession.status === "error";

  function handleSave() {
    saveLook();
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelLook} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white/95 backdrop-blur-sm border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-bold text-gray-900">Look Studio</h2>
              <p className="text-xs text-gray-500">
                Building on {lookSession.anchorProduct.title}
              </p>
            </div>
          </div>
          <button
            onClick={cancelLook}
            aria-label="Close look studio"
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5 p-5">
          {/* LEFT — composite + pieces + actions */}
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 aspect-[3/4]">
              {currentLookImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentLookImage}
                  alt="Current look"
                  className="w-full h-full object-contain"
                />
              )}
              {isAddingToLook && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
                  <p className="text-xs font-medium text-indigo-700">Adding to your look…</p>
                </div>
              )}
            </div>

            {isError && lookSession.errorMessage && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 rounded-xl text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{lookSession.errorMessage}</span>
              </div>
            )}

            {/* Pieces in this look */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  In this look ({pieces.length})
                </p>
                {lookSession.items.length > 0 && !isAddingToLook && (
                  <button
                    onClick={removeLastLookItem}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Undo2 className="h-3 w-3" />
                    Remove last
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {pieces.map((p, i) => (
                  <div
                    key={`${p.id}-${i}`}
                    className="w-12 h-14 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shrink-0"
                    title={`${p.title}${i === 0 ? " (anchor)" : ""}`}
                  >
                    <ProductImage
                      src={p.imageUrl}
                      title={p.title}
                      category={p.category}
                      className="w-full h-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              {saved ? (
                <Link
                  href="/wishlist"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Look saved · View in wishlist
                </Link>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isAddingToLook}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Heart className="h-4 w-4" />
                  Save this Look
                </button>
              )}
              <button
                onClick={cancelLook}
                className="w-full py-2.5 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Done
              </button>
            </div>
          </div>

          {/* RIGHT — add coordinated pieces (nested try-on) */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Add pieces</h3>
            <p className="text-xs text-gray-500 mb-4">
              Each piece is tried on over your current look.
            </p>
            <LookBuilder
              product={lookSession.anchorProduct}
              onAddToLook={(product) => {
                setSaved(false);
                addToLook(product);
              }}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}

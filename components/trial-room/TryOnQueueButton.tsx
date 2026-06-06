"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Check, Loader2, RotateCcw, ExternalLink, Info } from "lucide-react";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface Props {
  product: Product;
}

/**
 * Context-aware CTA on the product detail page.
 *
 * When no photo has been uploaded the button no longer navigates away.
 * Instead it shows an inline guidance message directing the user to set up
 * the Trial Room from the catalog, keeping them on the current product page.
 */
export function TryOnQueueButton({ product }: Props) {
  const { photo, addToQueue, retryTryOn, findActiveTryOn, triggerSetupHint } =
    useTrialRoom();
  const [showHint, setShowHint] = useState(false);

  if (!product.imageUrl) return null;

  const entry = findActiveTryOn(product.id);

  // ── No photo: show guidance inline, do not navigate ────────────────────
  if (!photo) {
    function handleSetupClick() {
      triggerSetupHint();
      setShowHint(true);
      setTimeout(() => setShowHint(false), 4000);
    }

    return (
      <div className="space-y-2">
        <button
          onClick={handleSetupClick}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-2xl",
            "text-sm font-semibold",
            "bg-gradient-to-r from-indigo-500 to-purple-600 text-white",
            "shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
          )}
        >
          <Camera className="h-4 w-4" />
          Set up Trial Room to try this on
        </button>

        {showHint && (
          <div className="flex items-start gap-2.5 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-800 leading-relaxed">
              Go to the{" "}
              <Link
                href="/catalog"
                className="font-semibold underline underline-offset-2 hover:text-indigo-600"
              >
                Catalog
              </Link>{" "}
              and tap <strong>Set Up Trial Room</strong> to upload a customer
              photo before adding try-ons.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Generating ─────────────────────────────────────────────────────────
  if (entry?.status === "generating") {
    return (
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-indigo-50 text-indigo-400 cursor-not-allowed"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Generating try-on…
      </button>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────
  if (entry?.status === "done") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 py-2.5 px-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-700">Try-on ready</span>
        </div>
        <Link
          href="/my-try-ons"
          className="flex items-center gap-1.5 py-2.5 px-4 bg-white border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          View
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  // ── Failed ─────────────────────────────────────────────────────────────
  if (entry?.status === "failed") {
    return (
      <div className="space-y-2">
        <button
          onClick={() => retryTryOn(entry.id)}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-2xl",
            "text-sm font-semibold",
            "bg-gradient-to-r from-indigo-500 to-purple-600 text-white",
            "shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
          )}
        >
          <RotateCcw className="h-4 w-4" />
          Retry Virtual Try-On
        </button>
        {entry.errorMessage && (
          <p className="text-xs text-red-500 text-center">{entry.errorMessage}</p>
        )}
      </div>
    );
  }

  // ── Default: add to queue ──────────────────────────────────────────────
  return (
    <button
      onClick={() => addToQueue(product)}
      className={cn(
        "w-full flex items-center justify-center gap-2 py-3 rounded-2xl",
        "text-sm font-semibold",
        "bg-gradient-to-r from-indigo-500 to-purple-600 text-white",
        "shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
      )}
    >
      <Camera className="h-4 w-4" />
      Add for Virtual Try-On
    </button>
  );
}

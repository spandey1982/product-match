"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, ExternalLink } from "lucide-react";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";
import { TrialRoomSetupModal } from "@/components/trial-room/TrialRoomSetupModal";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface Props {
  product: Product;
  /**
   * Render as a circular icon-only FAB instead of the full-width button.
   * Used on the mobile product detail page where the CTA sits directly on
   * the image card. State machine and click behavior are identical to the
   * default render — only the visual condenses.
   */
  iconOnly?: boolean;
}

/**
 * Context-aware CTA on the product detail page.
 *
 * When no photo has been uploaded the button opens the Trial Room setup
 * modal in-place so the user never has to leave the product page.
 * After uploading a photo they can immediately add the product for try-on.
 */
export function TryOnQueueButton({ product, iconOnly = false }: Props) {
  const router = useRouter();
  const { photo, addToQueue, retryTryOn, findActiveTryOn, isAtLimit } = useTrialRoom();
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  if (!product.imageUrl) return null;

  const entry = findActiveTryOn(product.id);

  // ── Icon-only FAB (mobile product detail) ─────────────────────────────────
  // Mirrors the state machine below in a compact circular button. Kept in the
  // same component so context wiring + modal management stay in one place.
  if (iconOnly) {
    let iconNode: React.ReactNode;
    let variantClass: string;
    let label: string;
    let onClick: () => void = () => {};
    let disabled = false;

    if (!photo) {
      iconNode = <HangerPlusIcon size={20} />;
      // Disabled/initial (no photo yet) — theme-coloured border + indigo-tinted
      // icon so it reads as a live affordance for setting up the Trial Room,
      // not a dead grey control.
      variantClass =
        "bg-white/95 text-indigo-500 border-2 border-indigo-300 backdrop-blur-sm hover:bg-white hover:text-indigo-600 hover:border-indigo-400";
      label = "Set up Trial Room to try this on";
      onClick = () => setSetupModalOpen(true);
    } else if (entry?.status === "generating") {
      iconNode = <Loader2 size={20} className="animate-spin" />;
      variantClass = "bg-indigo-500 text-white shadow-indigo-300/50";
      label = "Generating try-on…";
      disabled = true;
    } else if (entry?.status === "done") {
      iconNode = <Check size={20} />;
      variantClass =
        "bg-emerald-500 text-white shadow-emerald-300/50 hover:bg-emerald-600";
      label = "Try-on ready — tap to view";
      onClick = () => router.push("/trial-room");
    } else if (entry?.status === "failed") {
      iconNode = <RotateCcw size={20} />;
      variantClass =
        "bg-white/95 text-red-500 border border-red-200 backdrop-blur-sm hover:bg-white";
      label = entry.errorMessage ?? "Try-on failed — tap to retry";
      onClick = () => retryTryOn(entry.id);
    } else if (isAtLimit) {
      iconNode = <HangerPlusIcon size={20} />;
      variantClass =
        "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100";
      label = "Try-on limit reached — tap to manage";
      onClick = () => router.push("/trial-room");
    } else {
      iconNode = <HangerPlusIcon size={20} />;
      variantClass =
        "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-300/50 hover:opacity-90";
      label = "Add for Virtual Try-On";
      onClick = () => addToQueue(product);
    }

    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }}
          disabled={disabled}
          aria-label={label}
          title={label}
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center shadow-lg",
            "transition-all duration-150 active:scale-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed",
            variantClass
          )}
        >
          {iconNode}
        </button>
        {setupModalOpen && (
          <TrialRoomSetupModal onClose={() => setSetupModalOpen(false)} />
        )}
      </>
    );
  }

  // ── No photo: open setup modal inline ─────────────────────────────────────
  if (!photo) {
    return (
      <>
        <button
          onClick={() => setSetupModalOpen(true)}
          className={cn(
            "w-full flex items-center justify-center gap-2 h-12 rounded-2xl",
            "text-sm font-semibold",
            "bg-gradient-to-r from-indigo-500 to-purple-600 text-white",
            "shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
          )}
        >
          <HangerPlusIcon className="h-4 w-4" />
          Set up Trial Room to try this on
        </button>

        {setupModalOpen && (
          <TrialRoomSetupModal onClose={() => setSetupModalOpen(false)} />
        )}
      </>
    );
  }

  // ── Generating ─────────────────────────────────────────────────────────────
  if (entry?.status === "generating") {
    return (
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-semibold bg-indigo-50 text-indigo-400 cursor-not-allowed"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Generating try-on…
      </button>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  if (entry?.status === "done") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-700">Try-on ready</span>
        </div>
        <Link
          href="/trial-room"
          className="flex items-center gap-1.5 py-2 px-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          View
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  // ── Failed ──────────────────────────────────────────────────────────────────
  if (entry?.status === "failed") {
    return (
      <div className="space-y-2">
        <button
          onClick={() => retryTryOn(entry.id)}
          className={cn(
            "w-full flex items-center justify-center gap-2 h-12 rounded-2xl",
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

  // ── At limit: can't add more ────────────────────────────────────────────────
  if (isAtLimit) {
    return (
      <div className="space-y-2">
        <div className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700">
          <HangerPlusIcon className="h-4 w-4" />
          Try-on limit reached (5/5)
        </div>
        <Link
          href="/trial-room"
          className="w-full flex items-center justify-center gap-1.5 h-12 rounded-2xl text-sm font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors"
        >
          Manage Try-Ons to free up a slot
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  // ── Default: add to queue ───────────────────────────────────────────────────
  return (
    <button
      onClick={() => addToQueue(product)}
      className={cn(
        "w-full flex items-center justify-center gap-2 h-12 rounded-2xl",
        "text-sm font-semibold",
        "bg-gradient-to-r from-indigo-500 to-purple-600 text-white",
        "shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
      )}
    >
      <HangerPlusIcon className="h-4 w-4" />
      Add for Virtual Try-On
    </button>
  );
}

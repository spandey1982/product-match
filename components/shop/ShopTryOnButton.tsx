"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, ExternalLink, UserPlus } from "lucide-react";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";
import { TrialRoomSetupModal } from "@/components/trial-room/TrialRoomSetupModal";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { CreditTopUpPicker } from "@/components/shop/CreditTopUpPicker";
import { SIGN_IN_FOR_CREDITS_MESSAGE, INSUFFICIENT_CREDITS_MESSAGE } from "@/lib/vto-credits/packages";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface Props {
  product: Product;
  loggedIn: boolean;
  /** This customer's current try-on credit balance — 0/ignored for a guest. */
  initialCredits: number;
  iconOnly?: boolean;
  myTryOnsHref?: string;
}

/**
 * /shop's try-on CTA — same state machine as TryOnQueueButton, plus two
 * states that button doesn't need: signed-out (gated up front, not just
 * left to 401 at generation time) and out-of-credits (shows the top-up
 * picker inline instead of a dead-end "Retry"). Credit balance is tracked
 * optimistically client-side — decremented on a successful generation,
 * bumped on a top-up purchase — since the generation response doesn't
 * round-trip through TrialRoomProvider's plumbing (see lib/vto-credits/packages.ts).
 */
export function ShopTryOnButton({ product, loggedIn, initialCredits, iconOnly = false, myTryOnsHref = "/shop/my-try-ons" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { photo, addToQueue, retryTryOn, findActiveTryOn } = useTrialRoom();
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [credits, setCredits] = useState(initialCredits);
  const [showTopUp, setShowTopUp] = useState(false);
  // Guests see a normal-looking try-on CTA first — the account requirement
  // only surfaces once they actually click it, not upfront.
  const [revealSignIn, setRevealSignIn] = useState(false);

  const entry = findActiveTryOn(product.id);
  const prevStatusRef = useRef(entry?.status);

  useEffect(() => {
    if (prevStatusRef.current !== "done" && entry?.status === "done") {
      setCredits((c) => Math.max(0, c - 1));
    }
    prevStatusRef.current = entry?.status;
  }, [entry?.status]);

  if (!product.imageUrl) return null;

  const signInHref = `/rent/login?returnTo=${encodeURIComponent(pathname || "/shop")}`;
  const insufficientCredits = entry?.status === "failed" && entry.errorMessage === INSUFFICIENT_CREDITS_MESSAGE;
  // A guest gets the same generation flow as a logged-in customer while
  // their pre-login pool (credits, sourced from GuestTryOnUsage) still has
  // room — the sign-in prompt only appears once it's spent, or if a request
  // somehow reaches the API without one (SIGN_IN_FOR_CREDITS_MESSAGE).
  const needsSignIn =
    (!loggedIn && credits <= 0) ||
    (entry?.status === "failed" && entry.errorMessage === SIGN_IN_FOR_CREDITS_MESSAGE);

  // ── Icon-only FAB ───────────────────────────────────────────────────────────
  if (iconOnly) {
    let iconNode: React.ReactNode;
    let variantClass: string;
    let label: string;
    let onClick: () => void = () => {};
    let disabled = false;

    if (needsSignIn) {
      iconNode = <HangerPlusIcon size={20} />;
      variantClass = "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-300/50 hover:opacity-90";
      label = "Try it on virtually";
      onClick = () => router.push(signInHref);
    } else if (!photo) {
      iconNode = <HangerPlusIcon size={20} />;
      variantClass = "bg-white/95 text-indigo-500 border-2 border-indigo-300 backdrop-blur-sm hover:bg-white hover:text-indigo-600 hover:border-indigo-400";
      label = "Set up Trial Room to try this on";
      onClick = () => setSetupModalOpen(true);
    } else if (entry?.status === "generating") {
      iconNode = <Loader2 size={20} className="animate-spin" />;
      variantClass = "bg-indigo-500 text-white shadow-indigo-300/50";
      label = "Generating try-on…";
      disabled = true;
    } else if (entry?.status === "done") {
      iconNode = <Check size={20} />;
      variantClass = "bg-emerald-500 text-white shadow-emerald-300/50 hover:bg-emerald-600";
      label = "Try-on ready — tap to view";
      onClick = () => router.push(myTryOnsHref);
    } else if (insufficientCredits) {
      iconNode = <HangerPlusIcon size={20} />;
      variantClass = "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100";
      label = "Out of try-ons — tap to top up";
      onClick = () => setShowTopUp(true);
    } else if (entry?.status === "failed") {
      iconNode = <RotateCcw size={20} />;
      variantClass = "bg-white/95 text-red-500 border border-red-200 backdrop-blur-sm hover:bg-white";
      label = entry.errorMessage ?? "Try-on failed — tap to retry";
      onClick = () => retryTryOn(entry.id);
    } else if (credits <= 0) {
      iconNode = <HangerPlusIcon size={20} />;
      variantClass = "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100";
      label = "Out of try-ons — tap to top up";
      onClick = () => setShowTopUp(true);
    } else {
      iconNode = <HangerPlusIcon size={20} />;
      variantClass = "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-300/50 hover:opacity-90";
      label = "Add for Virtual Try-On";
      onClick = () => addToQueue(product);
    }

    return (
      <>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
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
        {setupModalOpen && <TrialRoomSetupModal onClose={() => setSetupModalOpen(false)} />}
      </>
    );
  }

  // ── Signed out — a normal-looking CTA; the account requirement only shows
  // once clicked, not upfront ──────────────────────────────────────────────
  if (needsSignIn) {
    if (!revealSignIn) {
      return (
        <button
          onClick={() => setRevealSignIn(true)}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <HangerPlusIcon className="h-4 w-4" />
          Try It On Virtually
        </button>
      );
    }
    return (
      <div className="space-y-2 p-3 rounded-2xl border border-indigo-100 bg-indigo-50/50">
        <p className="text-xs text-indigo-700 text-center">
          {SIGN_IN_FOR_CREDITS_MESSAGE}
        </p>
        <Link
          href={signInHref}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <UserPlus className="h-4 w-4" />
          Sign In / Create Account
        </Link>
      </div>
    );
  }

  // ── No photo: open setup modal inline ─────────────────────────────────────
  if (!photo) {
    return (
      <>
        <button
          onClick={() => setSetupModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <HangerPlusIcon className="h-4 w-4" />
          Set up Trial Room to try this on
        </button>
        {setupModalOpen && <TrialRoomSetupModal onClose={() => setSetupModalOpen(false)} />}
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
          href={myTryOnsHref}
          className="flex items-center gap-1.5 py-2 px-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          View
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  // ── Out of credits (either pre-empted client-side, or discovered via a failed attempt) ──
  if (credits <= 0 || insufficientCredits || showTopUp) {
    return (
      <CreditTopUpPicker
        onPurchased={(newBalance) => {
          setCredits(newBalance);
          setShowTopUp(false);
        }}
      />
    );
  }

  // ── Failed (generic) ────────────────────────────────────────────────────────
  if (entry?.status === "failed") {
    return (
      <div className="space-y-2">
        <button
          onClick={() => retryTryOn(entry.id)}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
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

  // ── Default: add to queue ───────────────────────────────────────────────────
  return (
    <button
      onClick={() => addToQueue(product)}
      className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
    >
      <HangerPlusIcon className="h-4 w-4" />
      Add for Virtual Try-On ({credits} left)
    </button>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { Product } from "@/types";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { useState } from "react";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";
import { cn } from "@/lib/utils";

interface TryOnCardButtonProps {
  product: Product;
  /** Where the "view ready / manage limit" states navigate. Defaults to the retailer dashboard's page. */
  myTryOnsHref?: string;
}

/**
 * Compact circular try-on button placed at the right edge of a product card,
 * overlapping the boundary between the product image and the info strip
 * below. Shared by the retailer catalog (ProductCard) and the public rental
 * marketplace (RentalProductCard) — the state machine and visuals are
 * identical, only the "my try-ons" destination differs.
 */
export function TryOnCardButton({ product, myTryOnsHref = "/my-try-ons" }: TryOnCardButtonProps) {
  const router = useRouter();
  const { photo, addToQueue, findActiveTryOn, findAnyTryOn, isAtLimit, triggerSetupHint } =
    useTrialRoom();
  const [hinted, setHinted] = useState(false);

  // Products without an imageUrl cannot use the API — hide the button.
  if (!product.imageUrl) return null;

  const active = findActiveTryOn(product.id); // generating | done
  const any = findAnyTryOn(product.id);        // any entry incl. failed
  const isFailed = any?.status === "failed" && !active;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!photo) {
      // Do not navigate — pulse this button and highlight the catalog header CTA
      triggerSetupHint();
      setHinted(true);
      setTimeout(() => setHinted(false), 1500);
      return;
    }
    if (active?.status === "generating") return;
    if (active?.status === "done") { router.push(myTryOnsHref); return; }
    if (active) { router.push(myTryOnsHref); return; } // queued — go view it
    if (isAtLimit) { router.push(myTryOnsHref); return; } // limit hit — manage slot
    addToQueue(product);
  }

  // ── Appearance per state ───────────────────────────────────────────────────
  let icon: React.ReactNode;
  let classes: string;
  let label: string;
  let disabled = false;

  if (!photo) {
    icon = <HangerPlusIcon size={16} />;
    classes = cn(
      "bg-white/90 text-gray-500 shadow-md backdrop-blur-sm hover:bg-white hover:text-indigo-600",
      hinted && "ring-2 ring-indigo-400 ring-offset-1 text-indigo-600 bg-white"
    );
    label = "Set up Trial Room to try on";
  } else if (active?.status === "generating") {
    icon = <Loader2 size={16} className="animate-spin" />;
    classes = "bg-indigo-500 text-white shadow-md shadow-indigo-300/50";
    label = "Generating try-on…";
    disabled = true;
  } else if (active?.status === "done") {
    icon = <Check size={16} />;
    classes =
      "bg-emerald-500 text-white shadow-md shadow-emerald-300/50 hover:bg-emerald-600";
    label = "Try-on ready — tap to view";
  } else if (isAtLimit) {
    icon = <HangerPlusIcon size={16} />;
    classes =
      "bg-amber-50 text-amber-500 shadow-md border border-amber-200 hover:bg-amber-100";
    label = `Try-on limit reached — tap to manage`;
  } else if (isFailed) {
    icon = <RotateCcw size={16} />;
    classes =
      "bg-white/90 text-red-500 shadow-md backdrop-blur-sm hover:bg-white";
    label = "Try-on failed — tap to retry";
  } else {
    // Primary "add" state — matches the brand gradient used elsewhere
    icon = <HangerPlusIcon size={16} />;
    classes =
      "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-300/50 hover:opacity-90";
    label = "Add for Virtual Try-On";
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        // 36 × 36 px circle
        "h-9 w-9 rounded-full",
        "flex items-center justify-center",
        "transition-all duration-150 active:scale-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed",
        classes
      )}
    >
      {icon}
    </button>
  );
}

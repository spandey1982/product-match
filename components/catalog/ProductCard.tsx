"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { thumbnailUrl } from "@/lib/images/variants";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { useTrialRoom, TRYON_LIMIT } from "@/components/trial-room/TrialRoomProvider";
import { useState } from "react";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";
import { cn } from "@/lib/utils";

// ─── Try-On quick button ──────────────────────────────────────────────────────
//
// Compact circular button placed at the right edge of the product card,
// overlapping the boundary between the product image and the info strip below.
// Mirrors TryOnQueueButton's state machine, compressed for catalog grid use.

function TryOnCardButton({ product }: { product: Product }) {
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
    if (active?.status === "done") { router.push("/my-try-ons"); return; }
    if (active) { router.push("/my-try-ons"); return; } // queued — go view it
    if (isAtLimit) { router.push("/my-try-ons"); return; } // limit hit — manage slot
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

// ─── Product card ─────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">

        {/*
         * Image area:
         *  - Outer div: `relative aspect-[3/4]` with NO overflow-hidden.
         *    This allows the try-on button (bottom-0 translate-y-1/2) to
         *    protrude downward into the info strip without being clipped.
         *  - Inner div: `absolute inset-0 overflow-hidden rounded-t-2xl`
         *    clips the image and overlays to the card's top rounded corners.
         *  - The card outer div's overflow-hidden still contains everything
         *    within the full card boundary (button protrudes into the
         *    info padding zone, not outside the card).
         */}
        <div className="relative aspect-[3/4]">

          {/* Image + overlays — clipped to rounded top corners */}
          <div className="absolute inset-0 overflow-hidden rounded-t-2xl bg-gray-50">
            <ImageCarousel
              images={[
                product.modelImageUrl ? thumbnailUrl(product.modelImageUrl) : null,
                ...(product.generatedImages?.map((gi) => thumbnailUrl(gi.url)) ?? []),
                product.imageUrl ? thumbnailUrl(product.imageUrl) : null,
              ].filter(Boolean) as string[]}
              title={product.title}
              category={product.category}
              className="w-full h-full"
            />

{!product.inStock && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                <Badge variant="error">Out of Stock</Badge>
              </div>
            )}
          </div>

          {/*
           * Try-On button — right edge, overlapping image/info boundary.
           * `bottom-0 translate-y-1/2` centres the button on the boundary line.
           * `z-20` keeps it above both the image overlays and the info text.
           */}
          <div className="absolute right-3 bottom-0 translate-y-1/2 z-20">
            <TryOnCardButton product={product} />
          </div>
        </div>

        {/* Info strip — `pt-6` gives the overlapping button room to breathe */}
        <div className="px-4 pb-4 pt-6">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
              {product.title}
            </h3>
          </div>

<div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-full border border-gray-200 ring-1 ring-offset-1"
                style={{ backgroundColor: product.color.toLowerCase() }}
                title={product.color}
              />
              <span className="text-xs text-gray-500 capitalize">
                {product.color}
              </span>
            </div>
            <span className="text-sm font-bold text-gray-900">
              {formatCurrency(product.price)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

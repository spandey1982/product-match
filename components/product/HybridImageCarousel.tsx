"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";

interface HybridImageCarouselProps {
  /** Display-quality real image URLs — does NOT include the info slide. */
  images: string[];
  labels: string[];
  title: string;
  category: string;
  className?: string;
  /**
   * Where the non-image slide sits in the FULL slot sequence (0-based,
   * slots = images.length + 1). e.g. infoSlot=2 after front(0)/back(1).
   */
  infoSlot: number;
  renderInfoSlide: () => React.ReactNode;
  /** Controlled active slot, across the full sequence including the info slide. */
  activeSlot: number;
  onActiveSlotChange: (slot: number) => void;
  /** Fired on click/tap of a real-image slide (never the info slide) — e.g. to open a full-screen viewer. */
  onImageClick?: (realIndex: number) => void;
}

/**
 * ImageCarousel (components/product/ImageCarousel.tsx) only knows about a
 * flat list of images — its own prev/next/dots/swipe all operate in
 * real-image space, so a non-image slide spliced in at a fixed position
 * (the /shop PDP's "Additional Info" card) gets silently skipped by every
 * navigation control it has. Rather than bolt a "hidden slot" concept onto
 * that shared component (used by catalog cards, rental cards, and two other
 * PDPs), this is a small dedicated carousel whose slide sequence natively
 * includes the info slide as a first-class stop for swipe, arrows, and dots.
 */
export function HybridImageCarousel({
  images,
  labels,
  title,
  category,
  className,
  infoSlot,
  renderInfoSlide,
  activeSlot,
  onActiveSlotChange,
  onImageClick,
}: HybridImageCarouselProps) {
  const totalSlots = images.length + 1;
  const touchStartX = useRef<number | null>(null);

  function realIndexForSlot(slot: number): number {
    return slot < infoSlot ? slot : slot - 1;
  }

  function go(next: number) {
    onActiveSlotChange(((next % totalSlots) + totalSlots) % totalSlots);
  }
  function prev() { go(activeSlot - 1); }
  function next() { go(activeSlot + 1); }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next(); else prev();
    }
    touchStartX.current = null;
  }

  if (totalSlots <= 1) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        {images[0] ? (
          <ProductImage src={images[0]} title={title} category={category} className="w-full h-full" />
        ) : (
          renderInfoSlide()
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden group", className)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${activeSlot * 100}%)` }}
      >
        {Array.from({ length: totalSlots }).map((_, slot) => (
          <div
            key={slot}
            className="w-full h-full shrink-0"
            onClick={() => {
              if (slot !== infoSlot) onImageClick?.(realIndexForSlot(slot));
            }}
          >
            {slot === infoSlot ? (
              renderInfoSlide()
            ) : (
              <ProductImage
                src={images[realIndexForSlot(slot)]}
                title={title}
                category={category}
                className={cn("w-full h-full", onImageClick && "cursor-zoom-in")}
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); prev(); }}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/80 backdrop-blur-sm shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-gray-700 hover:bg-white"
        aria-label="Previous"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); next(); }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/80 backdrop-blur-sm shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-gray-700 hover:bg-white"
        aria-label="Next"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 z-10">
        {Array.from({ length: totalSlots }).map((_, slot) => (
          <button
            key={slot}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onActiveSlotChange(slot); }}
            className={cn(
              "rounded-full transition-all duration-200",
              slot === activeSlot ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50 hover:bg-white/75"
            )}
            aria-label={
              slot === infoSlot
                ? "Go to Additional Info"
                : `Go to ${labels[realIndexForSlot(slot)] ?? `image ${realIndexForSlot(slot) + 1}`}`
            }
          />
        ))}
      </div>
    </div>
  );
}

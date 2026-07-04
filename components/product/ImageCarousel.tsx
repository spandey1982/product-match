"use client";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";

interface ImageCarouselProps {
  images: (string | null | undefined)[];
  title: string;
  category: string;
  className?: string;
  /**
   * Optional label for each slide shown in the badge overlay.
   * Falls back to "Product" for index 0 and "On model" for all others.
   */
  labels?: string[];
  /** Controlled active slide index (e.g. driven by an external thumbnail rail). Uncontrolled (internal state) when omitted. */
  index?: number;
  /** Called whenever the active slide changes, controlled or not (swipe, arrows, dots). */
  onIndexChange?: (index: number) => void;
}

export function ImageCarousel({ images, title, category, className, labels, index: controlledIndex, onIndexChange }: ImageCarouselProps) {
  const validImages = images.filter(Boolean) as string[];
  const hasMultiple = validImages.length > 1;

  const [internalIndex, setInternalIndex] = useState(0);
  const index = controlledIndex ?? internalIndex;
  const touchStartX = useRef<number | null>(null);

  function setIndex(updater: number | ((i: number) => number)) {
    const next = typeof updater === "function" ? (updater as (i: number) => number)(index) : updater;
    setInternalIndex(next);
    onIndexChange?.(next);
  }

  function prev() { setIndex((i) => (i - 1 + validImages.length) % validImages.length); }
  function next() { setIndex((i) => (i + 1) % validImages.length); }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  }

  if (!hasMultiple) {
    return (
      <ProductImage
        src={validImages[0]}
        title={title}
        category={category}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden group", className)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Images */}
      <div
        className="flex h-full transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {validImages.map((src, i) => (
          <div key={i} className="w-full h-full shrink-0">
            <ProductImage
              src={src}
              title={title}
              category={category}
              className="w-full h-full"
            />
          </div>
        ))}
      </div>

      {/* Prev / Next arrows — visible on hover desktop */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); prev(); }}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/80 backdrop-blur-sm shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-gray-700 hover:bg-white"
        aria-label="Previous image"
      >
        <svg className="h-3 w-3" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 1L1 5l4 4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); next(); }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/80 backdrop-blur-sm shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-gray-700 hover:bg-white"
        aria-label="Next image"
      >
        <svg className="h-3 w-3" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 z-10">
        {validImages.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex(i); }}
            className={cn(
              "rounded-full transition-all duration-200",
              i === index
                ? "w-4 h-1.5 bg-white"
                : "w-1.5 h-1.5 bg-white/50 hover:bg-white/75"
            )}
            aria-label={i === 0 ? "Product image" : "Model image"}
          />
        ))}
      </div>

    </div>
  );
}

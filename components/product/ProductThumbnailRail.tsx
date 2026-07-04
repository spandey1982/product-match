"use client";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";

interface ProductThumbnailRailProps {
  /** Thumbnail-variant URLs (see lib/images/variants.ts) — never upscaled, aspect preserved. */
  images: string[];
  labels: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  title: string;
  category: string;
  className?: string;
}

/**
 * Vertical (horizontal on narrow screens) list of every image available for a
 * product, so a retailer can jump straight to any card/crop without cycling
 * through the main carousel. Each thumbnail keeps the source's native 3:4
 * aspect ratio — no cropping, just a bounded-size delivery variant.
 */
export function ProductThumbnailRail({
  images,
  labels,
  activeIndex,
  onSelect,
  title,
  category,
  className,
}: ProductThumbnailRailProps) {
  if (images.length < 2) return null;

  return (
    <div
      className={cn(
        "flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto lg:max-h-[560px] pb-1 lg:pb-0",
        className
      )}
    >
      {images.map((src, i) => (
        <button
          key={`${src}-${i}`}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`View ${labels[i] ?? `image ${i + 1}`}`}
          aria-current={i === activeIndex}
          className={cn(
            "relative w-14 sm:w-16 aspect-[3/4] shrink-0 rounded-xl overflow-hidden bg-gray-50 border-2 transition-all",
            i === activeIndex
              ? "border-indigo-500 ring-2 ring-indigo-100"
              : "border-transparent opacity-60 hover:opacity-100"
          )}
        >
          <ProductImage src={src} title={title} category={category} className="w-full h-full" />
        </button>
      ))}
    </div>
  );
}

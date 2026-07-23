"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { getProductCardImages } from "@/lib/product/card-images";
import { Badge } from "@/components/ui/badge";
import { TryOnCardButton } from "@/components/trial-room/TryOnCardButton";
import { useGenerationStatus } from "@/components/generation/GenerationStatusProvider";

// ─── Product card ─────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { getStatus, subscribe, unsubscribe } = useGenerationStatus();
  const isGenerating = getStatus(product.id)?.generating ?? false;

  const [completedImages, setCompletedImages] = useState<{
    modelImageUrl: string | null;
    generatedImages: { url: string; view: string; objective?: string }[];
  } | null>(null);

  useEffect(() => {
    function onComplete(
      data: { modelImageUrl: string | null; generatedImages: { url: string; view: string; objective?: string }[] } | null,
    ) {
      if (data) setCompletedImages(data);
    }
    subscribe(product.id, onComplete);
    return () => { unsubscribe(product.id, onComplete); };
  }, [product.id, subscribe, unsubscribe]);

  const displayProduct = completedImages
    ? {
        ...product,
        modelImageUrl: completedImages.modelImageUrl,
        generatedImages: completedImages.generatedImages.map((g) => ({
          id: "", productId: product.id, isPrimary: false, createdAt: "",
          objective: "",
          ...g,
        })),
      }
    : product;

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
              images={getProductCardImages(displayProduct)}
              title={product.title}
              category={product.category}
              className="w-full h-full"
            />

{!product.inStock && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                <Badge variant="error">Out of Stock</Badge>
              </div>
            )}

            {isGenerating && (
              <div className="absolute top-2.5 left-2.5 z-10">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm shadow-sm">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                </div>
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
            <h3
              title={product.title}
              className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2.25rem] group-hover:text-indigo-600 transition-colors"
            >
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

"use client";
import Link from "next/link";
import { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
        {/* Image carousel */}
        <div className="relative aspect-[3/4] overflow-hidden">
          <ImageCarousel
            images={[product.imageUrl, product.modelImageUrl]}
            title={product.title}
            category={product.category}
            className="w-full h-full"
          />
          {/* Match indicator */}
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-indigo-600 shadow-sm">
              <Sparkles className="h-3 w-3" />
              Match
            </div>
          </div>
          {!product.inStock && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
              <Badge variant="error">Out of Stock</Badge>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
              {product.title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            <Badge variant="outline" className="text-xs capitalize">
              {product.category}
            </Badge>
            {product.styleTags[0] && (
              <Badge variant="purple" className="text-xs capitalize">
                {product.styleTags[0]}
              </Badge>
            )}
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

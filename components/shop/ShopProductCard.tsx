"use client";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { getProductCardImages } from "@/lib/product/card-images";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/shop/WishlistButton";
import { PublicShopProduct } from "@/lib/shop/public-product";
import { colorSwatchHex } from "@/lib/product-detail/color-presentation";
import { formatLabel } from "@/lib/product-detail/format";

interface ShopProductCardProps {
  product: PublicShopProduct;
  initialWishlisted: boolean;
  loggedIn: boolean;
  /** e.g. the wishlist page uses this to drop the card once its heart is unset. */
  onWishlistToggled?: (wishlisted: boolean) => void;
}

export function ShopProductCard({ product, initialWishlisted, loggedIn, onWishlistToggled }: ShopProductCardProps) {
  // Same trailing-raw-upload trim as both PDPs — getProductCardImages
  // appends the retailer's raw uploaded photo last (label "Product");
  // customers only see the generated/model shots, as long as at least one
  // exists (never leave the carousel empty).
  const cardImages = getProductCardImages(product);
  const hasTrailingRawImage = Boolean(product.imageUrl) && cardImages.length > 1;
  const images = hasTrailingRawImage ? cardImages.slice(0, -1) : cardImages;

  return (
    <Link href={`/shop/${product.id}`} className="group block">
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
        <div className="relative aspect-[3/4]">
          <div className="absolute inset-0 overflow-hidden rounded-t-2xl bg-gray-50">
            <ImageCarousel
              images={images}
              title={product.title}
              category={product.category}
              className="w-full h-full"
            />
          </div>

          {!product.inStock && (
            <div className="absolute left-3 top-3 z-10">
              <Badge variant="error">Out of Stock</Badge>
            </div>
          )}

          <div className="absolute right-3 top-3 z-20">
            <WishlistButton
              productId={product.id}
              initialWishlisted={initialWishlisted}
              loggedIn={loggedIn}
              onToggled={onWishlistToggled}
              size="xs"
            />
          </div>
        </div>

        <div className="px-4 pb-4 pt-4 space-y-2">
          <h3
            title={product.title}
            className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2.25rem] group-hover:text-indigo-600 transition-colors"
          >
            {product.title}
          </h3>

          {product.storeName && (
            <p className="text-[11px] text-gray-400 truncate">{product.storeName}</p>
          )}

          {product.distanceKm !== null && (
            <p className="text-[11px] text-gray-400">{Math.round(product.distanceKm)} km away</p>
          )}

          <div className="flex items-end justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="h-3.5 w-3.5 rounded-full ring-1 ring-gray-200 shrink-0"
                style={{ backgroundColor: colorSwatchHex(product.color) }}
              />
              <span className="text-xs text-gray-500">{formatLabel(product.color)}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {product.mrpPrice != null && product.mrpPrice > product.price && (
                <span className="text-[10px] text-gray-400 line-through">{formatCurrency(product.mrpPrice)}</span>
              )}
              <p className="text-sm font-bold text-gray-900">{formatCurrency(product.price)}</p>
            </div>
          </div>

          <Button size="sm" className="w-full mt-1">
            Try & Buy
          </Button>
        </div>
      </div>
    </Link>
  );
}

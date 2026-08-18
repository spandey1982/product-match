"use client";
import { useState } from "react";
import Link from "next/link";
import { Heart, ArrowLeft } from "lucide-react";
import { PublicShopProduct } from "@/lib/shop/public-product";
import { ShopProductCard } from "@/components/shop/ShopProductCard";
import { Button } from "@/components/ui/button";

interface WishlistViewProps {
  initialProducts: PublicShopProduct[];
}

export function WishlistView({ initialProducts }: WishlistViewProps) {
  const [products, setProducts] = useState(initialProducts);

  function handleToggled(productId: string, wishlisted: boolean) {
    if (!wishlisted) {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  }

  return (
    <div>
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Shop
      </Link>

      <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900 mb-6">My Wishlist</h1>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 text-rose-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Your wishlist is empty</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            Tap the heart on any product to save it here.
          </p>
          <Link href="/shop">
            <Button variant="secondary">Browse Shop</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product) => (
            <ShopProductCard
              key={product.id}
              product={product}
              initialWishlisted
              loggedIn
              onWishlistToggled={(wishlisted) => handleToggled(product.id, wishlisted)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  productId: string;
  initialWishlisted: boolean;
  /** Whether a customer session exists — a guest is sent to sign in instead of toggling. */
  loggedIn: boolean;
  className?: string;
  size?: "sm" | "md";
  /** Fired after a successful toggle — e.g. the wishlist page uses this to drop a card once unheart. */
  onToggled?: (wishlisted: boolean) => void;
}

/**
 * Shared floating heart used on both ShopProductCard (catalog grid) and
 * ShopProductDetailView — the first real, server-persisted wishlist in this
 * codebase (see Wishlist model). A guest gets sent to sign in with the
 * current page as returnTo, same pattern as the rest of /shop's account
 * gates (try-on credits, checkout).
 */
export function WishlistButton({ productId, initialWishlisted, loggedIn, className, size = "sm", onToggled }: WishlistButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [pending, setPending] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!loggedIn) {
      router.push(`/rent/login?returnTo=${encodeURIComponent(pathname || "/shop")}`);
      return;
    }
    if (pending) return;

    const next = !wishlisted;
    setWishlisted(next);
    setPending(true);
    try {
      if (next) {
        await fetch("/api/customer/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
      } else {
        await fetch(`/api/customer/wishlist/${productId}`, { method: "DELETE" });
      }
      onToggled?.(next);
    } catch {
      setWishlisted(!next);
    } finally {
      setPending(false);
    }
  }

  const dims = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconDims = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        dims,
        "rounded-full flex items-center justify-center backdrop-blur-sm shadow-md transition-all active:scale-90",
        wishlisted ? "bg-rose-500 text-white" : "bg-white/90 text-gray-500 hover:text-rose-500",
        className
      )}
    >
      <Heart className={cn(iconDims, wishlisted && "fill-current")} strokeWidth={1.75} />
    </button>
  );
}

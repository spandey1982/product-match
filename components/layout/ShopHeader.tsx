import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { ShopAuthStatus } from "@/components/layout/ShopAuthStatus";

/**
 * Header for /shop — sibling to PublicHeader (which is /rent-specific).
 * Adds a standalone wishlist icon next to the profile icon, deliberately not
 * folded into the profile dropdown (kept minimal there, see ShopAuthStatus).
 */
export async function ShopHeader() {
  const session = await getCustomerSession();

  let name: string | null = null;
  let wishlistCount = 0;
  if (session) {
    const [customer, count] = await Promise.all([
      db.customer.findUnique({ where: { id: session.id }, select: { name: true } }),
      db.wishlist.count({ where: { customerId: session.id } }),
    ]);
    name = customer?.name ?? null;
    wishlistCount = count;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/shop" className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">Mentis</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/shop/wishlist"
            aria-label="Wishlist"
            className="relative h-9 w-9 rounded-full flex items-center justify-center text-gray-500 hover:text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <Heart className="h-4 w-4" strokeWidth={1.75} />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-0.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            )}
          </Link>

          <ShopAuthStatus phone={session?.phone ?? null} name={name} />
        </div>
      </div>
    </header>
  );
}

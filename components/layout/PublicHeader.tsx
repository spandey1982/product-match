import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getCustomerSession } from "@/lib/customer-auth";
import { CustomerAuthStatus } from "@/components/layout/CustomerAuthStatus";

/**
 * Header for public, unauthenticated pages (the /rent marketplace). Distinct
 * from Navbar, which carries retailer-only actions (Add Product, Wishlist,
 * account menu with Sign out) that don't apply to an anonymous visitor.
 */
export async function PublicHeader() {
  const session = await getCustomerSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/rent" className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">Mentis</span>
        </Link>

        <CustomerAuthStatus phone={session?.phone ?? null} />
      </div>
    </header>
  );
}

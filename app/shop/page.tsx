import { Sparkles } from "lucide-react";
import { getCustomerSession } from "@/lib/customer-auth";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_CONTENT } from "@/lib/shop/category-content";
import { categoryIcon } from "@/lib/shop/category-icon";
import { getBestSellers } from "@/lib/shop/best-sellers";
import { ProductRail } from "@/components/shop/ProductRail";
import { ShopView } from "./ShopView";

export const metadata = {
  title: "Shop — Mentis",
  description:
    "Browse AI-catalogued fashion from Mentis retailers — sarees, lehengas, kurtis, and more, with virtual try-on and smart outfit matching on every product.",
  alternates: { canonical: "/shop" },
};

// Categories with the most live inventory get an "About" blurb below the
// grid — real, hand-written copy (lib/shop/category-content.ts), not
// generated marketing filler, and capped so the page doesn't turn into a
// keyword-stuffed link list.
const ABOUT_CATEGORY_COUNT = 4;

async function loadCategorySummary() {
  const [totalActive, byCategory] = await Promise.all([
    db.product.count({ where: { isActive: true, inStock: true } }),
    db.product.groupBy({
      by: ["category"],
      where: { isActive: true, inStock: true },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
    }),
  ]);
  return { totalActive, byCategory };
}

export default async function ShopPage() {
  const [session, adminSession, { totalActive, byCategory }, bestSellers] = await Promise.all([
    getCustomerSession(),
    getSession(),
    loadCategorySummary(),
    getBestSellers(8),
  ]);

  const wishlistedIds = session
    ? (
        await db.wishlist.findMany({
          where: { customerId: session.id },
          select: { productId: true },
        })
      ).map((w) => w.productId)
    : [];
  const wishlistedIdSet = new Set(wishlistedIds);

  const topCategories = byCategory.slice(0, ABOUT_CATEGORY_COUNT);
  const itemListJsonLd = bestSellers.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Best Sellers on Mentis",
        itemListElement: bestSellers.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://mentishq.com"}/shop/${p.id}`,
        })),
      }
    : undefined;

  return (
    <>
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <ShopView loggedIn={!!session} wishlistedIds={wishlistedIds} isAdmin={isAdmin(adminSession)} />

      <ProductRail
        title="Best Sellers"
        products={bestSellers}
        wishlistedIds={wishlistedIdSet}
        loggedIn={!!session}
      />

      {totalActive > 0 && (
        <section className="mt-16 pt-10 border-t border-gray-100">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 tracking-wide uppercase">
              <Sparkles size={13} /> About Mentis Shop
            </span>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Browse <span className="font-semibold text-gray-900">{totalActive} products</span> across{" "}
              <span className="font-semibold text-gray-900">{byCategory.length} categories</span> on Mentis —
              every listing includes AI virtual try-on and smart outfit-matching recommendations,
              sourced directly from Indian ethnic fashion retailers.
            </p>
          </div>

          {topCategories.some(({ category }) => CATEGORY_CONTENT[category]) && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topCategories.map(({ category, _count }) => {
                const blurb = CATEGORY_CONTENT[category];
                if (!blurb) return null;
                const Icon = categoryIcon(category);
                return (
                  <div
                    key={category}
                    className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex gap-3"
                  >
                    <div className="shrink-0 h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Icon size={16} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <h3 className="text-sm font-semibold text-gray-900">{category}</h3>
                        <span className="text-xs text-gray-400">({_count._all})</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{blurb}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}

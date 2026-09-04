import { getCustomerSession } from "@/lib/customer-auth";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_CONTENT } from "@/lib/shop/category-content";
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
        <section className="mt-12 pt-8 border-t border-gray-100 space-y-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            Browse {totalActive} products across {byCategory.length} categories on Mentis —
            every listing includes AI virtual try-on and smart outfit-matching recommendations,
            sourced from Indian ethnic fashion retailers.
          </p>
          {topCategories.map(({ category, _count }) => (
            CATEGORY_CONTENT[category] ? (
              <p key={category} className="text-xs text-gray-400 leading-relaxed">
                <span className="font-medium text-gray-500">{category} ({_count._all}):</span>{" "}
                {CATEGORY_CONTENT[category]}
              </p>
            ) : null
          ))}
        </section>
      )}
    </>
  );
}

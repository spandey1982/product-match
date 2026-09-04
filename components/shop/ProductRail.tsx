import { ShopProductCard } from "@/components/shop/ShopProductCard";
import { PublicShopProduct } from "@/lib/shop/public-product";

interface ProductRailProps {
  title: string;
  products: PublicShopProduct[];
  wishlistedIds: Set<string>;
  loggedIn: boolean;
}

/**
 * Shared rail for "People also buy" (app/shop/[id]) and "Best Sellers"
 * (app/shop) — same ShopProductCard used across the rest of /shop, so these
 * sections match the site's existing look rather than introducing a new
 * card style. Renders nothing when the list is empty (e.g. a fresh catalog
 * with no completed orders yet for Best Sellers) rather than an empty shell.
 */
export function ProductRail({ title, products, wishlistedIds, loggedIn }: ProductRailProps) {
  if (products.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <ShopProductCard
            key={product.id}
            product={product}
            initialWishlisted={wishlistedIds.has(product.id)}
            loggedIn={loggedIn}
          />
        ))}
      </div>
    </section>
  );
}

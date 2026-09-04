import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getProductCardFramedImages } from "@/lib/product/card-images";
import { getAggregateRating } from "@/lib/reviews/aggregate";
import { parseArray } from "@/lib/serialize";
import { getRelatedProducts } from "@/lib/shop/related-products";
import { toPublicShopProduct } from "@/lib/shop/public-product";
import { getCustomerSession } from "@/lib/customer-auth";
import { peekGuestDeviceId } from "@/lib/shop/guest-device";
import { FREE_TRYON_CREDITS } from "@/lib/vto-credits/packages";
import type { Product } from "@/types";
import { Breadcrumb } from "@/components/shop/Breadcrumb";
import { ProductRail } from "@/components/shop/ProductRail";
import { ShopProductDetailView } from "./ShopProductDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mentishq.com";

function buildProductDescription(product: {
  description?: string | null;
  category: string;
  color: string;
  occasion: string[];
}): string {
  if (product.description) return product.description.slice(0, 300);
  const occasion = product.occasion[0];
  return `${product.color} ${product.category}${occasion ? ` for ${occasion}` : ""} — shop on Mentis.`;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const raw = await db.product.findFirst({
    where: { id, isActive: true },
    select: {
      title: true, description: true, category: true, color: true, occasion: true,
      imageUrl: true, modelImageUrl: true,
      generatedImages: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
    },
  });
  if (!raw) return { title: "Shop — Mentis" };

  const description = buildProductDescription({
    description: raw.description,
    category: raw.category,
    color: raw.color,
    occasion: parseArray(raw.occasion),
  });
  const images = getProductCardFramedImages(raw as unknown as Product);

  return {
    title: `${raw.title} — Shop — Mentis`,
    description,
    alternates: { canonical: `/shop/${id}` },
    openGraph: {
      url: `/shop/${id}`,
      title: raw.title,
      description,
      images: images.length ? images : undefined,
    },
  };
}

export default async function ShopProductPage({ params }: Props) {
  const { id } = await params;

  const raw = await db.product.findFirst({
    where: { id, isActive: true },
    include: {
      generatedImages: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      user: { select: { storeName: true, storePhone: true, storeAddress: true, storeCity: true } },
    },
  });

  if (!raw) notFound();

  const product = toPublicShopProduct(raw as unknown as Record<string, unknown>);
  const session = await getCustomerSession();
  const [relatedProducts, aggregateRating] = await Promise.all([
    getRelatedProducts(raw, 8),
    getAggregateRating(id),
  ]);
  const displayedProductIds = [id, ...relatedProducts.map((p) => p.id)];

  let initialAccount: { name: string; email?: string } | undefined;
  let initialAddresses: { id: string; label?: string; line1: string; pincode: string; landmark?: string; isDefault?: boolean }[] | undefined;
  let initialWishlisted = false;
  let initialTryOnCredits = 0;
  let wishlistedIds = new Set<string>();

  if (session) {
    const [customer, wishlistEntries] = await Promise.all([
      db.customer.findUnique({
        where: { id: session.id },
        include: { addresses: { orderBy: { createdAt: "asc" } } },
      }),
      db.wishlist.findMany({
        where: { customerId: session.id, productId: { in: displayedProductIds } },
        select: { productId: true },
      }),
    ]);
    if (customer) {
      initialAccount = { name: customer.name ?? "", email: customer.email ?? undefined };
      initialAddresses = customer.addresses.map((a) => ({
        id: a.id,
        label: a.label ?? undefined,
        line1: a.line1,
        pincode: a.pincode,
        landmark: a.landmark ?? undefined,
        isDefault: a.isDefault,
      }));
      initialTryOnCredits = customer.tryOnCredits;
    }
    wishlistedIds = new Set(wishlistEntries.map((w) => w.productId));
    initialWishlisted = wishlistedIds.has(id);
  } else {
    // Guest — their pre-login try-on pool (GuestTryOnUsage), not a customer
    // credit balance. No cookie yet means nothing's been spent (a fresh
    // guest_tryon_usage row is only created on their first actual try-on
    // POST, not just from visiting a page — see the tryon route).
    const deviceId = await peekGuestDeviceId();
    if (deviceId) {
      const usage = await db.guestTryOnUsage.findUnique({
        where: { deviceId },
        select: { usedCount: true },
      });
      initialTryOnCredits = usage ? Math.max(0, FREE_TRYON_CREDITS - usage.usedCount) : FREE_TRYON_CREDITS;
    } else {
      initialTryOnCredits = FREE_TRYON_CREDITS;
    }
  }

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: buildProductDescription(product),
    image: getProductCardFramedImages(product),
    sku: product.sku ?? undefined,
    category: product.category,
    brand: product.storeName ? { "@type": "Brand", name: product.storeName } : undefined,
    aggregateRating: aggregateRating
      ? { "@type": "AggregateRating", ratingValue: aggregateRating.ratingValue, reviewCount: aggregateRating.reviewCount }
      : undefined,
    offers: {
      "@type": "Offer",
      url: `${APP_URL}/shop/${id}`,
      priceCurrency: "INR",
      price: product.price,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${APP_URL}/shop` },
      { "@type": "ListItem", position: 2, name: product.category, item: `${APP_URL}/shop?category=${encodeURIComponent(product.category)}` },
      { "@type": "ListItem", position: 3, name: product.title, item: `${APP_URL}/shop/${id}` },
    ],
  };

  const relatedProductsJsonLd = relatedProducts.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "People also buy",
        itemListElement: relatedProducts.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${APP_URL}/shop/${p.id}`,
        })),
      }
    : undefined;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {relatedProductsJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(relatedProductsJsonLd) }}
        />
      )}
      <Breadcrumb
        items={[
          { label: "Shop", href: "/shop" },
          { label: product.category, href: `/shop?category=${encodeURIComponent(product.category)}` },
          { label: product.title },
        ]}
      />
      <ShopProductDetailView
        product={product}
        initialWishlisted={initialWishlisted}
        sessionPhone={session?.phone}
        initialAccount={initialAccount}
        initialAddresses={initialAddresses}
        initialTryOnCredits={initialTryOnCredits}
      />
      <ProductRail
        title="People also buy"
        products={relatedProducts}
        wishlistedIds={wishlistedIds}
        loggedIn={Boolean(session)}
      />
    </>
  );
}

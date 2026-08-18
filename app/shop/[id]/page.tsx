import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { toPublicShopProduct } from "@/lib/shop/public-product";
import { getCustomerSession } from "@/lib/customer-auth";
import { ShopProductDetailView } from "./ShopProductDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const product = await db.product.findFirst({
    where: { id, isActive: true },
    select: { title: true },
  });
  return { title: product ? `${product.title} — Shop — Mentis` : "Shop — Mentis" };
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

  let initialAccount: { name: string; email?: string } | undefined;
  let initialAddresses: { id: string; label?: string; line1: string; pincode: string; landmark?: string; isDefault?: boolean }[] | undefined;
  let initialWishlisted = false;
  let initialTryOnCredits = 0;

  if (session) {
    const [customer, wishlistEntry] = await Promise.all([
      db.customer.findUnique({
        where: { id: session.id },
        include: { addresses: { orderBy: { createdAt: "asc" } } },
      }),
      db.wishlist.findUnique({
        where: { customerId_productId: { customerId: session.id, productId: id } },
        select: { id: true },
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
    initialWishlisted = Boolean(wishlistEntry);
  }

  return (
    <ShopProductDetailView
      product={product}
      initialWishlisted={initialWishlisted}
      sessionPhone={session?.phone}
      initialAccount={initialAccount}
      initialAddresses={initialAddresses}
      initialTryOnCredits={initialTryOnCredits}
    />
  );
}

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { toPublicRentalProduct } from "@/lib/rental/public-product";
import { getCustomerSession } from "@/lib/customer-auth";
import { RentalProductDetailView } from "./RentalProductDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const product = await db.product.findFirst({
    where: { id, isActive: true },
    select: { title: true },
  });
  return { title: product ? `${product.title} — Rent — Mentis` : "Rent — Mentis" };
}

export default async function RentProductPage({ params }: Props) {
  const { id } = await params;

  const raw = await db.product.findFirst({
    where: { id, isActive: true },
    include: {
      generatedImages: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      user: { select: { storeName: true } },
    },
  });

  if (!raw) notFound();

  const product = toPublicRentalProduct(raw as unknown as Record<string, unknown>);
  const session = await getCustomerSession();

  // Only ever fetched for a verified, logged-in customer — a guest gets
  // neither of these, and there's no way to look this up for an arbitrary
  // phone number typed into a form (see RentalRequestModal's security note).
  let initialAccount: { name: string; email?: string } | undefined;
  let initialAddresses: { id: string; label?: string; line1: string; pincode: string; landmark?: string; isDefault?: boolean }[] | undefined;

  if (session) {
    const customer = await db.customer.findUnique({
      where: { id: session.id },
      include: { addresses: { orderBy: { createdAt: "asc" } } },
    });
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
    }
  }

  return (
    <RentalProductDetailView
      product={product}
      sessionPhone={session?.phone}
      initialAccount={initialAccount}
      initialAddresses={initialAddresses}
    />
  );
}

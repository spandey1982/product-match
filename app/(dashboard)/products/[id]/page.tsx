import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deserializeProduct } from "@/lib/serialize";
import { ProductDetailView } from "./ProductDetailView";
import type { Product } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: `${product?.title || "Product"} — ProductMatch` };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const raw = await db.product.findFirst({
    where: { id, userId: session.id },
  });

  if (!raw) notFound();

  const product = deserializeProduct(
    raw as unknown as Record<string, unknown>
  ) as unknown as Product;

  return <ProductDetailView product={product} />;
}

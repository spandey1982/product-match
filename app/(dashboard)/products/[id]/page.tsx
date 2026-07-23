import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deserializeProduct } from "@/lib/serialize";
import { ProductDetailView } from "./ProductDetailView";
import type { Product } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generating?: string; mode?: string; genFailed?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: `${product?.title || "Product"} — Mentis` };
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { generating, mode, genFailed } = await searchParams;
  const session = await getSession();
  if (!session) notFound();

  const raw = await db.product.findFirst({
    where: { id, userId: session.id },
  });

  if (!raw) notFound();

  const product = deserializeProduct(
    raw as unknown as Record<string, unknown>
  ) as unknown as Product;

  // Multi-view catalogue gallery (additive — empty for products generated with
  // the legacy single-image flow, where modelImageUrl still drives the carousel).
  const generatedImages = await db.productImage.findMany({
    where: { productId: id },
    orderBy: { createdAt: "asc" },
    select: { url: true, view: true, objective: true },
  });

  return (
    <ProductDetailView
      product={product}
      generatedImages={generatedImages}
      initialGenerating={generating === "1"}
      initialGenError={genFailed ?? null}
      rentalMode={mode === "rental"}
    />
  );
}

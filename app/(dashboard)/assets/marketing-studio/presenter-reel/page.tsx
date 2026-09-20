import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripDeliveryTransforms } from "@/lib/model-gen/crop-templates";
import { PresenterReelStudioView, type PersonaOption, type ProductPreview } from "./PresenterReelStudioView";

export const metadata: Metadata = { title: "Presenter Reel | Marketing Studio" };

// Same objective filter the orchestrator itself resolves against
// (lib/presenter-reel/orchestrator.ts's findGeneratedFrontPhoto) — this is
// a read-only preview query for the picker UI, not the source of truth for
// what actually gets animated; the API call re-resolves it server-side.
const GENERATED_OBJECTIVES = ["catalogue", "quick_listing"];

export default async function PresenterReelPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { productId } = await searchParams;

  let product: ProductPreview | null = null;
  if (productId) {
    const row = await db.product.findFirst({
      where: { id: productId, userId: session.id },
      select: { id: true, title: true },
    });
    if (row) {
      const photo = await db.productImage.findFirst({
        where: { productId: row.id, view: "front", objective: { in: GENERATED_OBJECTIVES } },
        orderBy: { createdAt: "desc" },
        select: { url: true },
      });
      product = {
        id: row.id,
        title: row.title,
        previewUrl: photo ? stripDeliveryTransforms(photo.url) : null,
      };
    }
  }

  const personas = await db.presenterPersona.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const pastJobs = product
    ? await db.presenterReelJob.findMany({
        where: { productId: product.id, userId: session.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <PresenterReelStudioView
      product={product}
      personas={personas as PersonaOption[]}
      initialHistory={JSON.parse(JSON.stringify(pastJobs))}
    />
  );
}

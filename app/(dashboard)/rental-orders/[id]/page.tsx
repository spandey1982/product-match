import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { toRentalOrderDTO } from "@/lib/rental/order-db";
import { RentalOrderAdminView } from "./RentalOrderAdminView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const order = await db.rentalOrder.findUnique({ where: { id }, select: { productTitle: true } });
  return { title: order ? `${order.productTitle} — Rental Orders — Mentis` : "Rental Orders — Mentis" };
}

/**
 * Retailer-facing order detail — distinct from the customer-facing receipt
 * at /rent/orders/[id]. Gated by retailer session, and further scoped to
 * orders placed against this retailer's own products (same ownership join
 * the Rental Orders list page uses) so one retailer can never open another's
 * order by guessing/typing a URL.
 */
export default async function RentalOrderAdminPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const row = await db.rentalOrder.findUnique({ where: { id } });
  if (!row) notFound();

  const product = await db.product.findFirst({
    where: { id: row.productId, userId: session.id },
    select: { id: true },
  });
  if (!product) notFound();

  return <RentalOrderAdminView order={toRentalOrderDTO(row)} />;
}

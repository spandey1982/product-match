import { db } from "@/lib/db";
import { toRentalOrderDTO } from "@/lib/rental/order-db";
import { RentalOrderConfirmationView } from "./RentalOrderConfirmationView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const order = await db.rentalOrder.findUnique({ where: { id }, select: { productTitle: true } });
  return { title: order ? `${order.productTitle} — Rent — Mentis` : "Rent — Mentis" };
}

/**
 * Rental request receipt — no invoice, no payment integration. Deliberately
 * NOT gated by session: a guest who just placed a request needs to see this
 * confirmation without ever having logged in.
 */
export default async function RentalOrderPage({ params }: Props) {
  const { id } = await params;
  const row = await db.rentalOrder.findUnique({ where: { id } });

  return <RentalOrderConfirmationView order={row ? toRentalOrderDTO(row) : null} />;
}

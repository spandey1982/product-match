import { db } from "@/lib/db";
import { toRentalOrderDTO } from "@/lib/rental/order-db";
import { getCustomerSession } from "@/lib/customer-auth";
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
 * Rental request receipt — no invoice. Deliberately NOT gated by session: a
 * guest who just placed a request needs to see this confirmation without
 * ever having logged in. Online prepayment (Pay Now) is the one action that
 * does require a session — `canPayOnline` tells the client view whether the
 * viewer is logged in as this order's own customer, without exposing the
 * session to a guest who isn't.
 */
export default async function RentalOrderPage({ params }: Props) {
  const { id } = await params;
  const row = await db.rentalOrder.findUnique({ where: { id } });
  const session = await getCustomerSession();
  const canPayOnline = !!session && !!row && session.id === row.customerId;

  return (
    <RentalOrderConfirmationView
      order={row ? toRentalOrderDTO(row) : null}
      canPayOnline={canPayOnline}
    />
  );
}

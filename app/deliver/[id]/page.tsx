import { db } from "@/lib/db";
import { toShopOrderDTO } from "@/lib/shop/order-db";
import { DeliveryVerificationView } from "./DeliveryVerificationView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const order = await db.shopOrder.findUnique({ where: { id }, select: { productTitle: true } });
  return {
    title: order ? `Deliver — ${order.productTitle}` : "Deliver — Mentis",
    robots: { index: false, follow: false },
  };
}

/**
 * Single-screen handoff for a home-trial order's delivery partner — order,
 * product, and customer/address details plus the two-step Order
 * Completed/Order Denied action (app/api/shop/orders/[id]/deliver). No
 * session/role check of any kind: the delivery partner is a third party with
 * no store/admin access, so this order's own unguessable cuid id is the only
 * access control, matching the same no-login posture as the customer-facing
 * /shop/orders/[id] confirmation page.
 */
export default async function DeliverPage({ params }: Props) {
  const { id } = await params;
  const row = await db.shopOrder.findUnique({ where: { id } });
  const order = row ? toShopOrderDTO(row) : null;

  return <DeliveryVerificationView order={order} />;
}

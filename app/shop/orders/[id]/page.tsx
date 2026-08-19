import { db } from "@/lib/db";
import { toShopOrderDTO } from "@/lib/shop/order-db";
import { ShopOrderConfirmationView } from "./ShopOrderConfirmationView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const order = await db.shopOrder.findUnique({ where: { id }, select: { productTitle: true } });
  return { title: order ? `${order.productTitle} — Shop — Mentis` : "Shop — Mentis" };
}

/**
 * Purchase receipt — no invoice, deliberately not gated by session (a guest
 * who just placed an order needs to see this without ever logging in), same
 * posture as /rent/orders/[id].
 */
export default async function ShopOrderPage({ params }: Props) {
  const { id } = await params;
  const row = await db.shopOrder.findUnique({ where: { id } });

  return <ShopOrderConfirmationView order={row ? toShopOrderDTO(row) : null} />;
}

import { db } from "@/lib/db";
import { toShopOrderDTO } from "@/lib/shop/order-db";
import { ShopOrderConfirmationView } from "./ShopOrderConfirmationView";
import { ShopTrialConfirmationView } from "./ShopTrialConfirmationView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const order = await db.shopOrder.findUnique({ where: { id }, select: { productTitle: true } });
  return { title: order ? `${order.productTitle} — Shop — Mentis` : "Shop — Mentis" };
}

/**
 * Order receipt — no invoice, deliberately not gated by session (a guest who
 * just placed an order needs to see this without ever logging in), same
 * posture as /rent/orders/[id]. Covers both /shop order kinds under one URL
 * family: a plain "buy" purchase (ShopOrderConfirmationView) and a "Try &
 * Buy" home-trial request (ShopTrialConfirmationView) — there is no separate
 * "trial" URL/id space anymore, just this order's orderType.
 */
export default async function ShopOrderPage({ params }: Props) {
  const { id } = await params;
  const row = await db.shopOrder.findUnique({ where: { id } });
  const order = row ? toShopOrderDTO(row) : null;

  if (order?.orderType === "trial") {
    return <ShopTrialConfirmationView order={order} />;
  }
  return <ShopOrderConfirmationView order={order} />;
}

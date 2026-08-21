import { db } from "@/lib/db";
import { toShopTrialRequestDTO } from "@/lib/shop/trial-request-db";
import { ShopTrialConfirmationView } from "./ShopTrialConfirmationView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const trialRequest = await db.shopTrialRequest.findUnique({ where: { id }, select: { productTitle: true } });
  return { title: trialRequest ? `${trialRequest.productTitle} — Shop — Mentis` : "Shop — Mentis" };
}

/**
 * Home-trial request receipt — no invoice. Deliberately NOT gated by
 * session: a guest who just submitted a request needs to see this
 * confirmation without ever having logged in. Sibling to
 * app/rent/orders/[id]/page.tsx, but for ShopTrialRequest — see that model's
 * doc comment in prisma/schema.prisma for why this is a separate table
 * rather than reusing RentalOrder.
 */
export default async function ShopTrialRequestPage({ params }: Props) {
  const { id } = await params;
  const row = await db.shopTrialRequest.findUnique({ where: { id } });

  return (
    <ShopTrialConfirmationView trialRequest={row ? toShopTrialRequestDTO(row) : null} />
  );
}

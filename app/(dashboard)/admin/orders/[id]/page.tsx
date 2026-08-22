import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { getAdminOrder } from "@/lib/orders/list";
import { getLatestPaymentSummary } from "@/lib/rental/payment";
import { AdminOrderView } from "./AdminOrderView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  return { title: order ? `${order.productTitle} — Orders — Admin` : "Orders — Admin" };
}

/**
 * Admin-only order detail — one view for both a RentalOrder and a trial
 * ShopOrder (see lib/orders/list.ts's getAdminOrder). Replaces the old
 * per-retailer RentalOrderAdminView; admin-gated like every other
 * app/(dashboard)/admin/* page rather than ownership-gated, since this page
 * covers orders across every retailer.
 */
export default async function AdminOrderDetailPage({ params }: Props) {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();

  // Real Razorpay payment records only exist for rental orders — trial orders are mocked, no live gateway wired yet.
  const payment = order.kind === "rental" ? await getLatestPaymentSummary(order.id) : null;

  return <AdminOrderView order={order} payment={payment} />;
}

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { toRentalOrderDTO } from "@/lib/rental/order-db";
import { OrdersView } from "./OrdersView";

export const metadata = {
  title: "My Orders — Rent — Mentis",
};

export default async function RentalOrdersPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/rent/login?returnTo=/rent/orders");

  const rows = await db.rentalOrder.findMany({
    where: { customerId: session.id },
    orderBy: { createdAt: "desc" },
  });

  return <OrdersView orders={rows.map(toRentalOrderDTO)} />;
}

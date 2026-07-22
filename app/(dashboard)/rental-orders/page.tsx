import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { toRentalOrderDTO } from "@/lib/rental/order-db";
import {
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABEL,
  formatDisplayDate,
  getDisplayStatus,
} from "@/lib/rental/order-mock";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Rental Orders — Mentis",
};

/**
 * Retailer-facing view of every rental request placed against this
 * retailer's own catalog. RentalOrder has no direct FK to User (productId is
 * a durable snapshot, not a relation — see schema comment), so this joins
 * through the retailer's own product IDs. Clean list only for now — status
 * filters, search, and per-order actions (assign rider, mark delivered,
 * etc.) are a later phase.
 */
export default async function RentalOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const products = await db.product.findMany({
    where: { userId: session.id },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);

  const rows = productIds.length
    ? await db.rentalOrder.findMany({
        where: { productId: { in: productIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const orders = rows.map(toRentalOrderDTO);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900">Rental Orders</h1>
        <p className="text-sm text-gray-500 mt-1">Rental requests placed against your catalog.</p>
      </div>

      <div className="overflow-x-auto bg-white border border-gray-100 rounded-2xl shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium whitespace-nowrap">Order</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Product</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Customer</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Event Date</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Rental Price</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Deposit</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No rental requests yet.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const status = getDisplayStatus(order);
                return (
                  <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/rent/orders/${order.id}`}
                        className="font-mono text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        #{order.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-[220px] truncate">{order.productTitle}</td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      <div>{order.customer.name}</div>
                      <div className="text-xs text-gray-400">{order.customer.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      {formatDisplayDate(order.eventDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={ORDER_STATUS_BADGE_VARIANT[status]}>{ORDER_STATUS_LABEL[status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                      {formatCurrency(order.rentalPricePerDay)}/day
                    </td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{formatCurrency(order.deposit)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

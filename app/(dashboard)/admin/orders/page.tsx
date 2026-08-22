import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { getAdminOrders } from "@/lib/orders/list";
import { ORDER_KIND_LABEL } from "@/lib/orders/types";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Orders — Admin" };

/**
 * Admin-only merged Orders list — every RentalOrder plus every "trial"
 * ShopOrder (home-trial requests) across the platform, most recent 100.
 * Replaces the old split between the per-retailer Rental Orders page and
 * this page's former Shop-Orders-only listing (see lib/orders/list.ts).
 * Admin-gated the same way as every other app/(dashboard)/admin/* page (404
 * for non-admins, no hint it exists).
 */
export default async function AdminOrdersPage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const orders = await getAdminOrders();

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Orders</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Rental and home-trial requests across the platform — most recent 100.
      </p>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-400">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Event Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Deposit</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      #{o.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-[220px] truncate">{o.productTitle}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {o.customer.name}
                    <span className="text-gray-400"> · {o.customer.phone}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{o.eventDateLabel}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{ORDER_KIND_LABEL[o.kind]}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={o.statusVariant}>{o.statusLabel}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={o.paymentVariant}>{o.paymentLabel}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {formatCurrency(o.price)}
                    {o.priceSuffix}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {o.deposit != null ? formatCurrency(o.deposit) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

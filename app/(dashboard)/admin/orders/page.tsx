import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABEL, getDisplayOrderStatus } from "@/lib/shop/order-mock";
import { toShopOrderDTO } from "@/lib/shop/order-db";

export const metadata = { title: "Shop Orders — Admin" };

const ORDER_TYPE_LABEL: Record<string, string> = { buy: "Buy", trial: "Home Trial" };

/**
 * Minimal admin-only list of /shop's orders (ShopOrder — both "buy"
 * purchases and "trial" home-trial requests) — Order Number, type, product,
 * customer, status, created date. Admin-gated the same way as every other
 * app/(dashboard)/admin/* page (404 for non-admins, no hint it exists).
 * Deliberately plain: no filters/pagination, just a recent-N table.
 */
export default async function AdminOrdersPage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const rows = await db.shopOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const orders = rows.map(toShopOrderDTO);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Shop Orders</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        /shop&apos;s purchase and home-trial requests — most recent 100.
      </p>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-400">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Order Number</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const displayStatus = o.orderType === "trial" ? getDisplayOrderStatus(o) : o.status;
                return (
                  <tr key={o.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-gray-700">{ORDER_TYPE_LABEL[o.orderType] ?? o.orderType}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-[220px] truncate">{o.productTitle}</td>
                    <td className="px-4 py-3 text-gray-700">{formatCurrency(o.amountTotal)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {o.customer.name}
                      <span className="text-gray-400"> · {o.customer.phone}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ORDER_STATUS_BADGE_VARIANT[displayStatus]}>
                        {ORDER_STATUS_LABEL[displayStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { TRIAL_STATUS_BADGE_VARIANT, TRIAL_STATUS_LABEL, getDisplayTrialStatus } from "@/lib/shop/trial-request-mock";
import { toShopTrialRequestDTO } from "@/lib/shop/trial-request-db";

export const metadata = { title: "Home Trial Requests — Admin" };

/**
 * Minimal admin-only list of /shop's home-trial requests (ShopTrialRequest)
 * — Trial Number, product, customer, status, created date. Admin-gated the
 * same way as every other app/(dashboard)/admin/* page (404 for non-admins,
 * no hint it exists). Deliberately plain: no filters/pagination, just a
 * recent-N table — the first real order/sales visibility surface in the
 * app (there was none before this).
 */
export default async function AdminTrialRequestsPage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const rows = await db.shopTrialRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const trialRequests = rows.map(toShopTrialRequestDTO);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Home Trial Requests</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        /shop&apos;s &quot;Try &amp; Buy&quot; requests — most recent 100.
      </p>

      {trialRequests.length === 0 ? (
        <p className="text-sm text-gray-400">No trial requests yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Trial Number</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {trialRequests.map((t) => {
                const displayStatus = getDisplayTrialStatus(t);
                return (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-[220px] truncate">{t.productTitle}</td>
                    <td className="px-4 py-3 text-gray-700">{formatCurrency(t.price)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {t.customer.name}
                      <span className="text-gray-400"> · {t.customer.phone}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={TRIAL_STATUS_BADGE_VARIANT[displayStatus]}>
                        {TRIAL_STATUS_LABEL[displayStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</td>
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

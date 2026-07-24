import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Billing Comparison — Internal" };

const DAYS = 30;

async function loadComparison() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since } };

  try {
    const [aiCostAgg, aiByFeature, walletDeductAgg, walletDeductByDesc] =
      await Promise.all([
        db.aiUsageEvent.aggregate({
          where,
          _count: { _all: true },
          _sum: { estimatedCostUsd: true },
        }),

        db.aiUsageEvent.groupBy({
          by: ["feature"],
          where,
          _count: { _all: true },
          _sum: { estimatedCostUsd: true },
        }),

        db.walletTransaction.aggregate({
          where: { ...where, type: "DEDUCT" },
          _count: { _all: true },
          _sum: { amountUsd: true },
        }),

        db.walletTransaction.findMany({
          where: { ...where, type: "DEDUCT" },
          select: { amountUsd: true, description: true },
        }),
      ]);

    const gcpTotal = aiCostAgg._sum.estimatedCostUsd ?? 0;
    const gcpCalls = aiCostAgg._count._all;

    const retailTotal = Math.abs(walletDeductAgg._sum.amountUsd ?? 0);
    const retailCalls = walletDeductAgg._count._all;

    const margin = retailTotal > 0 ? ((retailTotal - gcpTotal) / retailTotal) * 100 : 0;

    const gcpByFeature = aiByFeature.map((g) => ({
      feature: g.feature,
      calls: g._count._all,
      cost: g._sum.estimatedCostUsd ?? 0,
    })).sort((a, b) => b.cost - a.cost);

    const retailByOp = new Map<string, { calls: number; revenue: number }>();
    for (const tx of walletDeductByDesc) {
      const desc = tx.description.replace(/^\d+×\s*/, "").trim();
      const op = desc.split(" ")[0];
      const count = tx.description.match(/^(\d+)×/) ? parseInt(tx.description.match(/^(\d+)×/)![1], 10) : 1;
      const entry = retailByOp.get(op) ?? { calls: 0, revenue: 0 };
      entry.calls += count;
      entry.revenue += Math.abs(tx.amountUsd);
      retailByOp.set(op, entry);
    }

    const retailBreakdown = Array.from(retailByOp.entries())
      .map(([op, data]) => ({ operation: op, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    return { gcpTotal, gcpCalls, retailTotal, retailCalls, margin, gcpByFeature, retailBreakdown };
  } catch {
    return null;
  }
}

function Currency({ value, decimals = 4 }: { value: number; decimals?: number }) {
  return <span className="tabular-nums">${value.toFixed(decimals)}</span>;
}

export default async function BillingComparisonPage() {
  const session = await getSession();
  if (!session || !isAdmin(session)) notFound();

  const data = await loadComparison();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Billing Comparison</h1>
        <p className="text-sm text-gray-500 mt-1">
          Retail revenue vs estimated GCP cost — last {DAYS} days
        </p>
      </div>

      {!data ? (
        <p className="text-gray-400 text-sm">Unable to load billing data.</p>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Retail Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                <Currency value={data.retailTotal} />
              </p>
              <p className="text-xs text-gray-400 mt-1">{data.retailCalls} transactions</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">GCP Cost (est.)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                <Currency value={data.gcpTotal} />
              </p>
              <p className="text-xs text-gray-400 mt-1">{data.gcpCalls} AI calls</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Gross Margin</p>
              <p className={`text-2xl font-bold mt-1 ${data.margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {data.margin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-1">
                <Currency value={data.retailTotal - data.gcpTotal} /> profit
              </p>
            </div>
          </div>

          {/* GCP cost by feature */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">GCP Cost by Feature</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Feature</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Calls</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.gcpByFeature.map((f) => (
                    <tr key={f.feature} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-700">{f.feature}</td>
                      <td className="px-4 py-2 text-xs text-gray-600 text-right tabular-nums">{f.calls}</td>
                      <td className="px-4 py-2 text-xs text-gray-900 text-right font-medium tabular-nums">
                        <Currency value={f.cost} decimals={6} />
                      </td>
                    </tr>
                  ))}
                  {data.gcpByFeature.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-xs">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Retail revenue by operation */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Retail Revenue by Operation</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Operation</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Calls</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.retailBreakdown.map((op) => (
                    <tr key={op.operation} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-700">{op.operation}</td>
                      <td className="px-4 py-2 text-xs text-gray-600 text-right tabular-nums">{op.calls}</td>
                      <td className="px-4 py-2 text-xs text-gray-900 text-right font-medium tabular-nums">
                        <Currency value={op.revenue} decimals={6} />
                      </td>
                    </tr>
                  ))}
                  {data.retailBreakdown.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-xs">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

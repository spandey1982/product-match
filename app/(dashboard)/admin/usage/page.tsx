import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "AI Usage & Cost — Internal" };

/**
 * Internal-only AI cost dashboard (owners/admins). Admin-gated: non-admins get a
 * 404 (no hint it exists). Not linked from any retailer/customer navigation.
 * Reads the ai_usage_events ledger — the single source of truth for AI cost.
 */

const DAYS = 30;

/**
 * Load all dashboard aggregates. Returns null if the query fails (e.g. the
 * ai_usage_events table is not migrated yet) so the page degrades to an empty
 * state instead of throwing a 500.
 */
async function loadUsage() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since } };
  try {
    const [totals, errorCount, byProviderModel, byFeature, byStore, recent] = await Promise.all([
      db.aiUsageEvent.aggregate({
        where,
        _count: { _all: true },
        _sum: { estimatedCostUsd: true, totalTokens: true, imagesGenerated: true },
      }),
      db.aiUsageEvent.count({ where: { ...where, status: "error" } }),
      db.aiUsageEvent.groupBy({
        by: ["provider", "model"],
        where,
        _count: { _all: true },
        _sum: { estimatedCostUsd: true, totalTokens: true, imagesGenerated: true },
      }),
      db.aiUsageEvent.groupBy({
        by: ["feature"],
        where,
        _count: { _all: true },
        _sum: { estimatedCostUsd: true, imagesGenerated: true },
      }),
      db.aiUsageEvent.groupBy({
        by: ["storeId"],
        where,
        _count: { _all: true },
        _sum: { estimatedCostUsd: true },
      }),
      db.aiUsageEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, createdAt: true, provider: true, model: true, feature: true,
          totalTokens: true, imagesGenerated: true, durationMs: true,
          estimatedCostUsd: true, storeId: true, status: true,
        },
      }),
    ]);
    return { totals, errorCount, byProviderModel, byFeature, byStore, recent };
  } catch (err) {
    console.error("[admin/usage] failed to load:", err);
    return null;
  }
}

function usd(n: number | null | undefined): string {
  return `$${(n ?? 0).toFixed(4)}`;
}
function num(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString();
}

export default async function AdminUsagePage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const data = await loadUsage();

  const sortByCost = <T extends { _sum: { estimatedCostUsd: number | null } }>(rows: T[]) =>
    [...rows].sort((a, b) => (b._sum.estimatedCostUsd ?? 0) - (a._sum.estimatedCostUsd ?? 0));

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-900">AI Usage &amp; Cost</h1>
        <p className="mt-4 text-sm text-gray-500">
          Usage data is not available yet. If this is a new deploy, the
          <code className="mx-1 px-1 bg-gray-100 rounded">ai_usage_events</code>
          table may not be migrated. It populates as AI operations run.
        </p>
      </div>
    );
  }

  const { totals, errorCount, byProviderModel, byFeature, byStore, recent } = data;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">AI Usage &amp; Cost</h1>
          <p className="text-sm text-gray-500">
            Last {DAYS} days · estimates from pricing table (verify against live rates)
          </p>
        </div>
        <a
          href={`/api/admin/usage?format=csv&days=${DAYS}`}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg px-3 py-2"
        >
          Download CSV
        </a>
      </header>

      {/* Totals */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Est. cost", value: usd(totals._sum.estimatedCostUsd) },
          { label: "API calls", value: num(totals._count._all) },
          { label: "Errors", value: num(errorCount) },
          { label: "Tokens", value: num(totals._sum.totalTokens) },
          { label: "Images", value: num(totals._sum.imagesGenerated) },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className="text-lg font-semibold text-gray-900">{c.value}</div>
          </div>
        ))}
      </section>

      {/* By provider + model */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">By provider &amp; model</h2>
        <Table
          head={["Provider", "Model", "Calls", "Tokens", "Images", "Est. cost"]}
          rows={sortByCost(byProviderModel).map((r) => [
            r.provider, r.model, num(r._count._all),
            num(r._sum.totalTokens), num(r._sum.imagesGenerated), usd(r._sum.estimatedCostUsd),
          ])}
        />
      </section>

      {/* By feature */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">By feature</h2>
        <Table
          head={["Feature", "Calls", "Images", "Est. cost"]}
          rows={sortByCost(byFeature).map((r) => [
            r.feature, num(r._count._all), num(r._sum.imagesGenerated), usd(r._sum.estimatedCostUsd),
          ])}
        />
      </section>

      {/* By store */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">By store</h2>
        <Table
          head={["Store / Retailer", "Calls", "Est. cost"]}
          rows={sortByCost(byStore).map((r) => [
            r.storeId ?? "—", num(r._count._all), usd(r._sum.estimatedCostUsd),
          ])}
        />
      </section>

      {/* Recent events */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Recent calls</h2>
        <Table
          head={["When", "Provider", "Model", "Feature", "Tokens", "Img", "ms", "Cost", "Status"]}
          rows={recent.map((r) => [
            new Date(r.createdAt).toLocaleString(),
            r.provider, r.model, r.feature,
            num(r.totalTokens), num(r.imagesGenerated), num(r.durationMs),
            usd(r.estimatedCostUsd),
            r.status,
          ])}
        />
      </section>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto bg-white border border-gray-100 rounded-2xl shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-6 text-center text-gray-400">
                No data yet.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 text-gray-800 whitespace-nowrap">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

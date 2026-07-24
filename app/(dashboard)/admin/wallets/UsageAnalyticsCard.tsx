"use client";

import { useCallback, useState } from "react";
import { BarChart3, Download, Filter, Loader2, Store } from "lucide-react";

interface AnalyticsOp {
  id: string;
  label: string;
  calls: number;
  spent: number;
}

interface AnalyticsDay {
  date: string;
  calls: number;
  spent: number;
}

interface StoreOption {
  id: string;
  label: string;
}

interface AnalyticsData {
  operations: AnalyticsOp[];
  daily: AnalyticsDay[];
  totals: { spent: number; calls: number };
  stores: StoreOption[];
}

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

function buildCsv(analytics: AnalyticsData, storeName: string): string {
  const lines = [`Usage Analytics${storeName ? ` — ${storeName}` : " — All Stores"}`];
  lines.push("");
  lines.push("Operation,Calls,Spent (USD)");
  for (const op of analytics.operations) {
    lines.push(`"${op.label}",${op.calls},${op.spent.toFixed(6)}`);
  }
  lines.push("");
  lines.push("Date,Calls,Spent (USD)");
  for (const d of analytics.daily) {
    lines.push(`${d.date},${d.calls},${d.spent.toFixed(6)}`);
  }
  lines.push("");
  lines.push(`Total,${analytics.totals.calls},${analytics.totals.spent.toFixed(6)}`);
  return lines.join("\n");
}

function downloadCsvBlob(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SpendingBar({ ops }: { ops: AnalyticsOp[] }) {
  const max = Math.max(...ops.map((o) => o.spent), 0.000001);

  return (
    <div className="space-y-2">
      {ops.map((op) => (
        <div key={op.id} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 w-32 shrink-0 truncate">
            {op.label}
          </span>
          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
            <div
              className="h-full rounded bg-gradient-to-r from-indigo-400 to-indigo-500 transition-all duration-500"
              style={{ width: `${(op.spent / max) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-gray-700 w-20 text-right">
            ${op.spent.toFixed(4)}
          </span>
          <span className="text-[10px] tabular-nums text-gray-400 w-14 text-right">
            {op.calls} calls
          </span>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ daily }: { daily: AnalyticsDay[] }) {
  if (daily.length === 0) return null;

  const max = Math.max(...daily.map((d) => d.spent), 0.000001);
  const barWidth = Math.max(4, Math.min(24, Math.floor(600 / daily.length) - 2));

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 mb-2">Daily spending</p>
      <div className="flex items-end gap-[2px] h-20 overflow-x-auto">
        {daily.map((d) => (
          <div
            key={d.date}
            className="shrink-0 rounded-t bg-gradient-to-t from-indigo-400 to-indigo-300 transition-all duration-300"
            style={{
              width: barWidth,
              height: `${Math.max((d.spent / max) * 100, 2)}%`,
            }}
            title={`${d.date}: $${d.spent.toFixed(4)} (${d.calls} calls)`}
          />
        ))}
      </div>
      {daily.length > 1 && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">{daily[0].date}</span>
          <span className="text-[10px] text-gray-400">{daily[daily.length - 1].date}</span>
        </div>
      )}
    </div>
  );
}

export function UsageAnalyticsCard() {
  const defaults = defaultDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [storeId, setStoreId] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async (f: string, t: string, store: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: f, to: t });
      if (store) params.set("store", store);
      const res = await fetch(`/api/admin/wallet-analytics?${params}`);
      if (res.ok) setAnalytics(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const initialRef = useState(false);
  if (!initialRef[0]) {
    initialRef[1](true);
    fetchAnalytics(from, to, storeId);
  }

  function handleApplyFilter() {
    fetchAnalytics(from, to, storeId);
  }

  function handleExportCsv() {
    if (!analytics) return;
    const storeName = storeId
      ? analytics.stores.find((s) => s.id === storeId)?.label ?? ""
      : "";
    downloadCsvBlob(
      buildCsv(analytics, storeName),
      `usage-${storeId || "all"}-${from}-to-${to}.csv`,
    );
  }

  const stores = analytics?.stores ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          <h2 className="font-semibold text-gray-900 text-sm">Usage Analytics</h2>
        </div>
        {analytics && analytics.operations.length > 0 && (
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        )}
      </div>

      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 bg-white"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 bg-white"
          />

          <span className="text-gray-300 mx-1">|</span>

          <Store className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 bg-white min-w-[120px]"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <button
            onClick={handleApplyFilter}
            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : !analytics || analytics.operations.length === 0 ? (
          <p className="text-center text-gray-400 text-xs py-8">
            No usage data for this period
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Spent</p>
                <p className="text-lg font-bold tabular-nums text-gray-900">
                  ${analytics.totals.spent.toFixed(4)}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Calls</p>
                <p className="text-lg font-bold tabular-nums text-gray-900">
                  {analytics.totals.calls}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-2">Spending by operation</p>
            <SpendingBar ops={analytics.operations} />
            <DailyChart daily={analytics.daily} />
          </>
        )}
      </div>
    </div>
  );
}

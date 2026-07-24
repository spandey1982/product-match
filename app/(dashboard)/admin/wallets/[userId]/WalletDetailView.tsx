"use client";

import { useMemo, useState } from "react";
import { Plus, Minus, RotateCcw, Lock, Unlock, Filter } from "lucide-react";

interface WalletData {
  id: string;
  balanceUsd: number;
  totalCreditsUsd: number;
  remainingPercentage: number;
  status: string;
  lastExchangeRate: number | null;
}

interface Transaction {
  id: string;
  type: string;
  amountUsd: number;
  balanceAfter: number;
  description: string;
  initiatedBy: string;
  originalAmountInr: number | null;
  exchangeRate: number | null;
  createdAt: string;
}

interface Props {
  userId: string;
  userName: string;
  storeName: string | null;
  wallet: WalletData | null;
  transactions: Transaction[];
}

const ALL_TYPES = ["CREDIT", "DEDUCT", "RESERVE", "RELEASE", "ADJUSTMENT", "RESET"] as const;

const TYPE_COLORS: Record<string, string> = {
  CREDIT: "bg-emerald-50 text-emerald-700",
  DEDUCT: "bg-red-50 text-red-700",
  RESERVE: "bg-amber-50 text-amber-700",
  RELEASE: "bg-blue-50 text-blue-700",
  ADJUSTMENT: "bg-purple-50 text-purple-700",
  RESET: "bg-gray-100 text-gray-700",
};

const DATE_RANGES = [
  { label: "All", value: "all" },
  { label: "Today", value: "today" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
] as const;

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function WalletDetailView({ userId, userName, storeName, wallet, transactions: initialTxns }: Props) {
  const [creditAmount, setCreditAmount] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [transactions, setTransactions] = useState(initialTxns);
  const [walletState, setWalletState] = useState(wallet);

  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = transactions;

    if (typeFilter.size > 0) {
      list = list.filter((tx) => typeFilter.has(tx.type));
    }

    if (dateRange !== "all") {
      const now = new Date();
      let cutoff: Date;
      if (dateRange === "today") {
        cutoff = startOfDay(now);
      } else if (dateRange === "7d") {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      list = list.filter((tx) => new Date(tx.createdAt) >= cutoff);
    }

    return list;
  }, [transactions, typeFilter, dateRange]);

  function toggleType(t: string) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const hasActiveFilters = typeFilter.size > 0 || dateRange !== "all";

  async function refreshWallet() {
    const res = await fetch(`/api/admin/wallets/${userId}`);
    if (!res.ok) return;
    const data = await res.json();
    setWalletState(data.wallet);
    setTransactions(data.recentTransactions ?? []);
  }

  async function handleCredit() {
    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) { setError("Enter a valid INR amount"); return; }
    setLoading("credit"); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/admin/wallets/${userId}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountInr: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Credited $${data.creditedUsd.toFixed(4)} (₹${amount} @ ₹${data.exchangeRate.toFixed(2)}/USD)`);
      setCreditAmount("");
      await refreshWallet();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(null); }
  }

  async function handleAdjust() {
    const amount = parseFloat(adjustAmount);
    if (!amount) { setError("Enter a valid USD amount"); return; }
    setLoading("adjust"); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/admin/wallets/${userId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amount, description: adjustDesc || "Manual adjustment" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Adjusted by $${amount > 0 ? "+" : ""}${amount.toFixed(4)}`);
      setAdjustAmount(""); setAdjustDesc("");
      await refreshWallet();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(null); }
  }

  async function handleReset() {
    if (!confirm("Reset this wallet to zero? This cannot be undone.")) return;
    setLoading("reset"); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/admin/wallets/${userId}/reset`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess("Wallet reset to zero");
      await refreshWallet();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(null); }
  }

  async function handleFreeze() {
    setLoading("freeze"); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/admin/wallets/${userId}/freeze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Wallet ${data.status === "frozen" ? "frozen" : "unfrozen"}`);
      await refreshWallet();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(null); }
  }

  const pct = walletState?.remainingPercentage ?? 0;
  const barColor = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{userName}</h1>
        {storeName && <p className="text-sm text-gray-500">{storeName}</p>}
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Balance Overview */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Wallet Balance</h2>
          {walletState && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              walletState.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}>
              {walletState.status === "active" ? "Active" : "Frozen"}
            </span>
          )}
        </div>

        {walletState ? (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500">Balance</p>
                <p className="text-lg font-bold tabular-nums">${walletState.balanceUsd.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Credited</p>
                <p className="text-lg font-bold tabular-nums">${walletState.totalCreditsUsd.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Remaining</p>
                <p className="text-lg font-bold tabular-nums">{pct}%</p>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400">No wallet created yet. Add credits to initialize.</p>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <Plus className="h-4 w-4 text-emerald-500" /> Add Credits
          </h3>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="2000"
                className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleCredit}
              disabled={loading === "credit"}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {loading === "credit" ? "Adding..." : "Add"}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Exchange rate fetched automatically</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <Minus className="h-4 w-4 text-purple-500" /> Manual Adjustment
          </h3>
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                step="0.0001"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="+0.50 or -0.50"
                className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleAdjust}
              disabled={loading === "adjust"}
              className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loading === "adjust" ? "..." : "Adjust"}
            </button>
          </div>
          <input
            type="text"
            value={adjustDesc}
            onChange={(e) => setAdjustDesc(e.target.value)}
            placeholder="Reason for adjustment"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={handleReset}
          disabled={loading === "reset" || !walletState}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {loading === "reset" ? "Resetting..." : "Reset Wallet"}
        </button>
        <button
          onClick={handleFreeze}
          disabled={loading === "freeze" || !walletState}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {walletState?.status === "frozen"
            ? <><Unlock className="h-3.5 w-3.5" /> Unfreeze</>
            : <><Lock className="h-3.5 w-3.5" /> Freeze</>
          }
        </button>
      </div>

      {/* Transaction Ledger */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Transaction Ledger</h2>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              hasActiveFilters
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Filter className="h-3 w-3" />
            Filters
            {hasActiveFilters && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-4">
            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Date</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {DATE_RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setDateRange(r.value)}
                    className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      dateRange === r.value
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type chips */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Type</span>
              <div className="flex flex-wrap gap-1">
                {ALL_TYPES.map((t) => {
                  const active = typeFilter.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                        active
                          ? TYPE_COLORS[t]
                          : "bg-gray-100 text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => { setTypeFilter(new Set()); setDateRange("all"); }}
                className="text-[10px] text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Date</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Type</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Amount (USD)</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Balance After</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_COLORS[tx.type] ?? "bg-gray-100 text-gray-700"}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums text-xs font-medium ${tx.amountUsd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {tx.amountUsd >= 0 ? "+" : ""}{tx.amountUsd.toFixed(6)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-gray-600">
                    ${tx.balanceAfter.toFixed(6)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 max-w-xs">
                    <span className="block truncate cursor-default group relative" title={tx.description}>
                      {tx.description}
                      <span className="hidden group-hover:block absolute left-0 bottom-full mb-1 z-10 w-max max-w-sm px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-gray-800 shadow-lg whitespace-pre-wrap">
                        {tx.description}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-xs">
                    {transactions.length === 0 ? "No transactions yet" : "No transactions match filters"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

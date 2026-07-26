"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Receipt,
  Download,
  Sparkles,
  Zap,
  Calendar,
  ArrowUpRight,
  Shield,
  AlertTriangle,
  PieChart as PieChartIcon,
  Loader2,
  Filter,
} from "lucide-react";
import { creditAlertLevel } from "@/components/billing/CreditBalance";

interface WalletData {
  hasWallet: boolean;
  balanceUsd: number;
  totalCreditsUsd: number;
  remainingPercentage: number;
  usedPercentage: number;
  status: string;
  exchangeRate: number | null;
}

type PaymentStatus = "paid" | "failed" | "due" | "pending" | "refunded" | "trial" | "promo";

interface CreditTransaction {
  id: string;
  amountUsd: number;
  originalAmountInr: number | null;
  exchangeRate: number | null;
  paymentStatus: PaymentStatus;
  description: string;
  createdAt: string;
}

interface FeatureUsage {
  id: string;
  label: string;
  count: number;
}

const STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  due: "bg-amber-50 text-amber-700",
  pending: "bg-blue-50 text-blue-700",
  refunded: "bg-gray-100 text-gray-600",
  trial: "bg-indigo-50 text-indigo-700",
  promo: "bg-purple-50 text-purple-700",
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  failed: "Failed",
  due: "Due",
  pending: "Pending",
  refunded: "Refunded",
  trial: "Free Trial",
  promo: "Promotional",
};

const PIE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function formatInr(usd: number, rate: number | null): string {
  if (!rate) return `$${usd.toFixed(4)}`;
  const inr = usd * rate;
  return `₹${inr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function BalanceCard({ wallet }: { wallet: WalletData }) {
  const pct = wallet.remainingPercentage;
  const level = creditAlertLevel(pct);
  const rate = wallet.exchangeRate;

  const barGradient =
    level === "critical"
      ? "linear-gradient(to right, rgba(239,68,68,0.9), rgba(220,38,38,0.9))"
      : level === "warning"
        ? "linear-gradient(to right, rgba(245,158,11,0.85), rgba(234,88,12,0.85))"
        : (() => {
            const o = pct >= 50 ? 1 : pct >= 20 ? 0.7 : 0.45;
            return `linear-gradient(to right, rgba(99,102,241,${o}), rgba(139,92,246,${o}))`;
          })();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          Credit Balance
        </h2>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            wallet.status === "active"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {wallet.status === "active" ? "Active" : "Frozen"}
        </span>
      </div>

      {level !== "normal" && wallet.status !== "frozen" && (
        <div
          className={`flex items-start gap-2 rounded-xl px-3 py-2.5 mb-4 ${
            level === "critical"
              ? "bg-red-50 border border-red-100"
              : "bg-amber-50 border border-amber-100"
          }`}
        >
          <AlertTriangle
            className={`h-4 w-4 shrink-0 mt-0.5 ${
              level === "critical" ? "text-red-500" : "text-amber-500"
            }`}
          />
          <div>
            <p
              className={`text-xs font-semibold ${
                level === "critical" ? "text-red-700" : "text-amber-700"
              }`}
            >
              {level === "critical"
                ? "Credits almost depleted"
                : "Credits running low"}
            </p>
            <p
              className={`text-[11px] mt-0.5 ${
                level === "critical" ? "text-red-600" : "text-amber-600"
              }`}
            >
              {level === "critical"
                ? "You may not be able to complete AI operations. Please add credits soon."
                : "Consider adding credits to avoid interruptions during generation."}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Available</p>
          <p className="text-lg font-bold tabular-nums">
            {formatInr(wallet.balanceUsd, rate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Credited</p>
          <p className="text-lg font-bold tabular-nums">
            {formatInr(wallet.totalCreditsUsd, rate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Remaining</p>
          <p
            className={`text-lg font-bold tabular-nums ${
              level === "critical"
                ? "text-red-600"
                : level === "warning"
                  ? "text-amber-600"
                  : ""
            }`}
          >
            {pct}%
          </p>
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barGradient }}
        />
      </div>

      {rate && (
        <p className="mt-3 text-[10px] text-gray-400">
          Exchange rate: ₹{rate.toFixed(2)}/USD (at last credit top-up)
        </p>
      )}

      {wallet.status === "frozen" && (
        <p className="mt-3 text-xs text-red-600 flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Your account is frozen. Contact your administrator.
        </p>
      )}
    </div>
  );
}

function FeatureUsageChart() {
  const [features, setFeatures] = useState<FeatureUsage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const defaults = defaultDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  function fetchUsage(f: string, t: string) {
    setIsLoading(true);
    const params = new URLSearchParams({ from: f, to: t });
    fetch(`/api/wallet/feature-usage?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setFeatures(data.features ?? []);
          setTotalCount(data.totalCount ?? 0);
        }
      })
      .finally(() => setIsLoading(false));
  }

  const initRef = useState(false);
  if (!initRef[0]) {
    initRef[1](true);
    fetchUsage(from, to);
  }

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 72;
  const innerRadius = 44;

  function buildSlices() {
    if (totalCount === 0) return [];
    let cumAngle = -90;
    return features.map((feat, i) => {
      const pct = feat.count / totalCount;
      const angle = pct * 360;
      const startAngle = cumAngle;
      cumAngle += angle;
      const endAngle = cumAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const largeArc = angle > 180 ? 1 : 0;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);
      const ix1 = cx + innerRadius * Math.cos(endRad);
      const iy1 = cy + innerRadius * Math.sin(endRad);
      const ix2 = cx + innerRadius * Math.cos(startRad);
      const iy2 = cy + innerRadius * Math.sin(startRad);

      const d = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
        "Z",
      ].join(" ");

      // Tooltip anchor — midpoint of the arc on the outer edge.
      const midRad = ((startAngle + endAngle) / 2) * (Math.PI / 180);
      const tx = cx + (radius + 8) * Math.cos(midRad);
      const ty = cy + (radius + 8) * Math.sin(midRad);

      return { ...feat, d, color: PIE_COLORS[i % PIE_COLORS.length], pct, tx, ty };
    });
  }
  const slices = buildSlices();

  const dateFilter = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <PieChartIcon className="h-4 w-4 text-indigo-500" />
        <h2 className="font-semibold text-gray-900 text-sm">Feature Usage</h2>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500">Date range</span>
        </div>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white w-full"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white w-full"
        />
        <button
          onClick={() => fetchUsage(from, to)}
          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors w-full"
        >
          Apply
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="sm:w-40 shrink-0">{dateFilter}</div>
          <div className="flex-1 flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        </div>
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="sm:w-40 shrink-0">{dateFilter}</div>
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-gray-400">No usage recorded for this period</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="sm:w-40 shrink-0">{dateFilter}</div>

        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {slices.map((s) => (
                <path
                  key={s.id}
                  d={s.d}
                  fill={s.color}
                  stroke="white"
                  strokeWidth={2}
                  className="transition-opacity cursor-pointer"
                  opacity={hoveredSlice && hoveredSlice !== s.id ? 0.4 : 1}
                  onMouseEnter={() => setHoveredSlice(s.id)}
                  onMouseLeave={() => setHoveredSlice(null)}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] text-gray-500">Total</p>
              <p className="text-lg font-bold tabular-nums">{totalCount}</p>
            </div>

            {slices.map((s) =>
              hoveredSlice === s.id ? (
                <div
                  key={s.id}
                  className="absolute z-10 bg-gray-900 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg pointer-events-none whitespace-nowrap"
                  style={{
                    left: s.tx,
                    top: s.ty,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="font-medium">{s.label}</span>
                  <span className="text-gray-300 ml-1.5">{s.count}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreditHistoryCard({
  transactions,
}: {
  transactions: CreditTransaction[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-indigo-500" />
        <h2 className="font-semibold text-gray-900 text-sm">Credit History</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">
                Date
              </th>
              <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">
                Amount
              </th>
              <th className="text-center px-4 py-2 font-medium text-gray-600 text-xs">
                Status
              </th>
              <th className="text-center px-4 py-2 font-medium text-gray-600 text-xs">
                Invoice
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                  {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium text-gray-900">
                  {tx.originalAmountInr != null
                    ? `₹${tx.originalAmountInr.toLocaleString("en-IN")}`
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      STATUS_STYLES[tx.paymentStatus] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {STATUS_LABELS[tx.paymentStatus] ?? tx.paymentStatus}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Download invoice"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-400 text-xs"
                >
                  No credits added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-4 w-4 text-indigo-500" />
        <h2 className="font-semibold text-gray-900">Payment & Subscription</h2>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-900">
                Pilot Plan
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
              Active
            </span>
          </div>
          <p className="text-xs text-indigo-700">
            Pre-loaded credits managed by your administrator. Usage is
            billed per AI operation.
          </p>
        </div>

        <div className="p-4 border border-dashed border-gray-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Payment Method
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                No payment method on file
              </p>
            </div>
            <button
              disabled
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-400 cursor-not-allowed"
            >
              Add Card
            </button>
          </div>
        </div>

        <div className="p-4 border border-dashed border-gray-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Auto-Recharge
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Automatically top up when credits run low
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
              Coming Soon
            </span>
          </div>
        </div>

        <div className="p-4 border border-dashed border-gray-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Upgrade Plan
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Self-service recharges and custom plans
              </p>
            </div>
            <button
              disabled
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-400 cursor-not-allowed"
            >
              Explore Plans
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BillingView() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [walletRes, txRes] = await Promise.all([
          fetch("/api/wallet"),
          fetch("/api/wallet/transactions"),
        ]);
        if (walletRes.ok) setWallet(await walletRes.json());
        if (txRes.ok) {
          const data = await txRes.json();
          setTransactions(data.transactions ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded-xl" />
          <div className="h-40 bg-gray-100 rounded-2xl" />
          <div className="h-60 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-indigo-500" />
          Billing
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your credits, payment method, and subscription
        </p>
      </div>

      <div className="space-y-6">
        {wallet?.hasWallet && <BalanceCard wallet={wallet} />}
        <FeatureUsageChart />
        <PaymentCard />
        <CreditHistoryCard transactions={transactions} />
      </div>
    </div>
  );
}

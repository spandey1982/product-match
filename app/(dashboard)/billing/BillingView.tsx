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
} from "lucide-react";

interface WalletData {
  hasWallet: boolean;
  balanceUsd: number;
  totalCreditsUsd: number;
  remainingPercentage: number;
  usedPercentage: number;
  status: string;
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

function BalanceCard({ wallet }: { wallet: WalletData }) {
  const pct = wallet.remainingPercentage;
  const barOpacity = pct >= 50 ? 1 : pct >= 20 ? 0.7 : 0.45;

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

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Available</p>
          <p className="text-lg font-bold tabular-nums">
            ${wallet.balanceUsd.toFixed(4)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Credited</p>
          <p className="text-lg font-bold tabular-nums">
            ${wallet.totalCreditsUsd.toFixed(4)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Remaining</p>
          <p className="text-lg font-bold tabular-nums">{pct}%</p>
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, rgba(99,102,241,${barOpacity}), rgba(139,92,246,${barOpacity}))`,
          }}
        />
      </div>

      {wallet.status === "frozen" && (
        <p className="mt-3 text-xs text-red-600 flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Your account is frozen. Contact your administrator.
        </p>
      )}
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
        {/* Current plan */}
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

        {/* Payment method placeholder */}
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

        {/* Auto-recharge placeholder */}
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

        {/* Upgrade placeholder */}
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
        <PaymentCard />
        <CreditHistoryCard transactions={transactions} />
      </div>
    </div>
  );
}

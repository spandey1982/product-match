"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  Receipt,
  Download,
  Sparkles,
  Zap,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Loader2,
  IndianRupee,
} from "lucide-react";
import { creditAlertLevel } from "@/components/billing/CreditBalance";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color: string };
  prefill?: { email?: string; contact?: string };
}

interface RazorpayCheckoutInstance {
  open: () => void;
}

interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface BillingConfig {
  enabled: boolean;
  keyId: string | null;
  packs: { id: string; label: string; amountInr: number }[];
  customMinInr: number;
  customMaxInr: number;
}

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
  const level = creditAlertLevel(pct);

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

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.head.appendChild(script);
  });
}

function AddCreditsCard({ onSuccess }: { onSuccess: () => void }) {
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/billing/config")
      .then((r) => r.json())
      .then((d: BillingConfig) => {
        setConfig(d);
        if (d.packs.length > 0) setSelectedPack(d.packs[0].id);
      })
      .catch(() => {});
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!config?.enabled || !config.keyId) return;
    setError(null);
    setProcessing(true);

    try {
      const body: Record<string, unknown> = useCustom
        ? { customAmountInr: parseInt(customAmount, 10) }
        : { packId: selectedPack };

      const orderRes = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json();
        throw new Error(data.error ?? "Failed to create order");
      }

      const order = (await orderRes.json()) as {
        orderId: string;
        amountInr: number;
        amountPaise: number;
        currency: string;
        packLabel: string;
      };

      await loadRazorpayScript();

      if (!window.Razorpay) throw new Error("Razorpay not loaded");

      const rzp = new window.Razorpay({
        key: config.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Product Match",
        description: `Credit top-up: ${order.packLabel}`,
        order_id: order.orderId,
        handler: async (response: RazorpayPaymentResponse) => {
          try {
            const verifyRes = await fetch("/api/billing/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            if (!verifyRes.ok) {
              const data = await verifyRes.json();
              throw new Error(data.error ?? "Verification failed");
            }

            setSuccessAmount(order.amountInr);
            onSuccess();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setProcessing(false),
        },
        theme: { color: "#4f46e5" },
      });

      rzp.open();
    } catch (err) {
      setError((err as Error).message);
      setProcessing(false);
    }
  }, [config, selectedPack, useCustom, customAmount, onSuccess]);

  if (successAmount !== null) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
          <h3 className="font-semibold text-gray-900">Payment Successful</h3>
          <p className="text-sm text-gray-500 mt-1">
            ₹{successAmount.toLocaleString("en-IN")} has been added to your credit balance.
          </p>
          <button
            onClick={() => setSuccessAmount(null)}
            className="mt-4 px-4 py-1.5 rounded-xl bg-indigo-50 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            Add More Credits
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Plus className="h-4 w-4 text-indigo-500" />
          Add Credits
        </h2>
        {config && !config.enabled && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
            Not Configured
          </span>
        )}
      </div>

      {!config ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : !config.enabled ? (
        <p className="text-xs text-gray-400 py-4">
          Payment gateway is not configured yet. Contact your administrator.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {!useCustom ? (
              <div className="grid grid-cols-2 gap-2">
                {config.packs.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setSelectedPack(pack.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPack === pack.id
                        ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                      <IndianRupee className="h-3.5 w-3.5" />
                      {pack.amountInr.toLocaleString("en-IN")}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Enter amount"
                    min={config.customMinInr}
                    max={config.customMaxInr}
                    className="w-full rounded-xl border border-gray-200 pl-7 pr-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 outline-none"
                  />
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                  ₹{config.customMinInr}–₹{config.customMaxInr.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            <button
              onClick={() => {
                setUseCustom(!useCustom);
                setError(null);
              }}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {useCustom ? "Choose a credit pack" : "Enter custom amount"}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {error}
            </p>
          )}

          <button
            onClick={handlePurchase}
            disabled={
              processing ||
              (!useCustom && !selectedPack) ||
              (useCustom && (!customAmount || parseInt(customAmount, 10) < config.customMinInr || parseInt(customAmount, 10) > config.customMaxInr))
            }
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Pay{" "}
                {useCustom && customAmount
                  ? `₹${parseInt(customAmount, 10).toLocaleString("en-IN")}`
                  : selectedPack
                    ? config.packs.find((p) => p.id === selectedPack)?.label
                    : ""}
              </>
            )}
          </button>

          <p className="mt-2 text-[10px] text-gray-400 text-center">
            Secured by Razorpay. Cards, UPI, and Netbanking accepted.
          </p>
        </>
      )}
    </div>
  );
}

function PlanCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4 text-indigo-500" />
        <h2 className="font-semibold text-gray-900">Plan & Subscription</h2>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-900">
                Pay-as-you-go
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
              Active
            </span>
          </div>
          <p className="text-xs text-indigo-700">
            Top up credits as needed. Usage is billed per AI operation.
          </p>
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
      </div>
    </div>
  );
}

export function BillingView() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
          Manage your credits and top up as needed
        </p>
      </div>

      <div className="space-y-6">
        {wallet?.hasWallet && <BalanceCard wallet={wallet} />}
        <AddCreditsCard onSuccess={loadData} />
        <PlanCard />
        <CreditHistoryCard transactions={transactions} />
      </div>
    </div>
  );
}

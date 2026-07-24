import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { UsageAnalyticsCard } from "./UsageAnalyticsCard";

export const metadata = { title: "Wallet Management — Admin" };

async function loadWallets() {
  const users = await db.user.findMany({
    where: { role: "RETAILER" },
    select: {
      id: true,
      name: true,
      email: true,
      storeName: true,
      wallet: {
        select: {
          balanceUsd: true,
          totalCreditsUsd: true,
          status: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => {
    const w = u.wallet;
    const remaining = w && w.totalCreditsUsd > 0
      ? Math.round((w.balanceUsd / w.totalCreditsUsd) * 100)
      : 0;
    return { ...u, remainingPct: remaining };
  });
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
    }`}>
      {isActive ? "Active" : "Frozen"}
    </span>
  );
}

function BalanceBar({ pct }: { pct: number }) {
  const color = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 tabular-nums">{pct}%</span>
    </div>
  );
}

export default async function WalletsPage() {
  const session = await getSession();
  if (!session || !isAdmin(session)) notFound();

  const users = await loadWallets();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Wallet Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage retailer credit wallets for the pilot program
        </p>
      </div>

      <UsageAnalyticsCard />

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Store</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Balance (USD)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Credits Remaining</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.storeName || "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">
                    {u.wallet
                      ? `$${u.wallet.balanceUsd.toFixed(4)}`
                      : "No wallet"}
                  </td>
                  <td className="px-4 py-3">
                    {u.wallet ? <BalanceBar pct={u.remainingPct} /> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.wallet ? <StatusBadge status={u.wallet.status} /> : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/wallets/${u.id}`}
                      className="text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No retailers found
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

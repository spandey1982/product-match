"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserMinus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function StaffView({ initialManagers }: { initialManagers: UserRow[] }) {
  const router = useRouter();
  const [managers, setManagers] = useState(initialManagers);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/home-material/staff?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (res.ok) setResults(data.users);
    } finally {
      setSearching(false);
    }
  }

  async function setGrant(userId: string, grant: boolean) {
    setBusyId(userId);
    setError("");
    try {
      const res = await fetch("/api/admin/home-material/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, grant }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update access");
        return;
      }
      if (grant) {
        setManagers((m) => [...m.filter((u) => u.id !== userId), data.user].sort((a, b) => a.email.localeCompare(b.email)));
      } else {
        setManagers((m) => m.filter((u) => u.id !== userId));
      }
      setResults((r) => r.map((u) => (u.id === userId ? data.user : u)));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <h1 className="text-xl font-bold text-gray-900">Catalogue Staff Access</h1>
      <p className="text-sm text-gray-500 mt-1">
        Grant the Material Catalogue Manager role to a user so they can add/edit/review the wallpaper catalogue
        without full admin access (wallets, pricing, orders, etc. stay ADMIN-only).
      </p>

      <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-medium text-gray-500 mb-2">Find a user by email</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              leftIcon={<Search size={14} />}
              placeholder="name@example.com"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
          </div>
          <button
            onClick={search}
            disabled={searching}
            className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        {results.length > 0 && (
          <div className="mt-3 divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
            {results.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-gray-900">{u.name}</p>
                  <p className="text-[11px] text-gray-400">{u.email}</p>
                </div>
                {u.role === "ADMIN" ? (
                  <span className="text-[10px] text-gray-400">Already full admin</span>
                ) : u.role === "HM_CATALOGUE_MANAGER" ? (
                  <button
                    onClick={() => setGrant(u.id, false)}
                    disabled={busyId === u.id}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  >
                    <UserMinus size={11} /> Revoke
                  </button>
                ) : (
                  <button
                    onClick={() => setGrant(u.id, true)}
                    disabled={busyId === u.id}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                  >
                    <UserPlus size={11} /> Grant catalogue access
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 text-sm">Current catalogue managers</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {managers.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-xs font-medium text-gray-900">{u.name}</p>
                <p className="text-[11px] text-gray-400">{u.email}</p>
              </div>
              <button
                onClick={() => setGrant(u.id, false)}
                disabled={busyId === u.id}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg disabled:opacity-50"
              >
                <UserMinus size={11} /> Revoke
              </button>
            </div>
          ))}
          {managers.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-gray-400">No catalogue managers yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

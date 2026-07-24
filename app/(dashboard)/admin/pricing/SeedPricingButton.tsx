"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SeedPricingButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSeed() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pricing/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center mb-8">
      <p className="text-sm text-gray-500 mb-4">
        No active pricing configuration found.
      </p>
      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}
      <button
        onClick={handleSeed}
        disabled={loading}
        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Seeding..." : "Seed Pilot Pricing"}
      </button>
    </div>
  );
}

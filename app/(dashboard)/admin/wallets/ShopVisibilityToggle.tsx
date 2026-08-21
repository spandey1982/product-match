"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  initialShowOnShop: boolean;
}

/** Admin override for a store's /shop visibility — see User.showOnShop in schema.prisma. Not retailer-facing. */
export function ShopVisibilityToggle({ userId, initialShowOnShop }: Props) {
  const router = useRouter();
  const [showOnShop, setShowOnShop] = useState(initialShowOnShop);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const next = !showOnShop;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/wallets/${userId}/shop-visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showOnShop: next }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setShowOnShop(data.showOnShop);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={showOnShop}
      aria-label="Show this store's products on Shop"
      onClick={toggle}
      disabled={saving}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
        showOnShop ? "bg-indigo-600" : "bg-gray-300"
      )}
    >
      {saving ? (
        <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
      ) : (
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            showOnShop ? "translate-x-6" : "translate-x-1"
          )}
        />
      )}
    </button>
  );
}

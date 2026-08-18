"use client";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { CREDIT_PACKAGES } from "@/lib/vto-credits/packages";
import { cn } from "@/lib/utils";

interface CreditTopUpPickerProps {
  onPurchased: (newBalance: number) => void;
}

/**
 * Try-on credit package picker — "purchase" completes immediately (Phase 1
 * has no live payment gateway behind /api/customer/credits/topup yet, see
 * lib/vto-credits/packages.ts). Used inline wherever ShopTryOnButton hits
 * the 0-credits paywall.
 */
export function CreditTopUpPicker({ onPurchased }: CreditTopUpPickerProps) {
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase(packageId: string) {
    setError(null);
    setPurchasingId(packageId);
    try {
      const res = await fetch("/api/customer/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not complete the purchase. Please try again.");
        return;
      }
      onPurchased(data.tryOnCredits);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPurchasingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
        <Sparkles className="h-3.5 w-3.5" />
        Top up try-on credits
      </div>
      <div className="grid grid-cols-3 gap-2">
        {CREDIT_PACKAGES.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => handlePurchase(pack.id)}
            disabled={purchasingId !== null}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-xl border border-indigo-200 bg-white py-2.5 text-center transition-all",
              "hover:border-indigo-400 hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            {purchasingId === pack.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            ) : (
              <>
                <span className="text-sm font-bold text-gray-900">{pack.credits}</span>
                <span className="text-[10px] text-gray-500">{pack.credits === 1 ? "credit" : "credits"}</span>
                <span className="text-xs font-semibold text-indigo-600">₹{pack.priceInPaise / 100}</span>
              </>
            )}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

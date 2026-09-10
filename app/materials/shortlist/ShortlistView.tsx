"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { LeadCaptureButton } from "@/components/home-material/LeadCaptureButton";
import { parseJsonSafe } from "@/lib/home-material/client";
import { MATERIAL_TAXONOMY, type MaintenanceLevel, type MoistureLevel } from "@/lib/home-material/material-taxonomy";

type ShortlistProduct = {
  id: string;
  name: string;
  colorName: string | null;
  colorHex: string | null;
  finish: string | null;
  patternName: string | null;
  textureAssetUrl: string | null;
  material: {
    name: string;
    category: string;
    subtype: string;
    durability: string | null;
    maintenance: string | null;
    moistureSuitability: string | null;
  } | null;
  priceInr: number | null;
  priceIsExact: boolean;
  costRangeMinInr: number | null;
  costRangeMaxInr: number | null;
};

type ShortlistItem = {
  id: string;
  note: string | null;
  product: ShortlistProduct;
};

function costLabel(p: ShortlistProduct): string {
  if (p.priceIsExact && p.priceInr != null) return `₹${p.priceInr}/sqft`;
  if (p.costRangeMinInr != null && p.costRangeMaxInr != null) return `₹${p.costRangeMinInr}–₹${p.costRangeMaxInr}/sqft`;
  return "—";
}

// Structured durability/maintenance/moisture figures live only in the
// typed MATERIAL_TAXONOMY source (see app/materials/page.tsx and
// app/materials/guide/page.tsx — same lookup pattern), not on the
// HmMaterial DB row. Used here to work out which shortlisted item is
// objectively "best" per row (Option 2B highlights the strongest value),
// not just to display the figures.
const MAINTENANCE_RANK: Record<MaintenanceLevel, number> = { low: 3, medium: 2, high: 1 };
const MOISTURE_RANK: Record<MoistureLevel, number> = { poor: 1, fair: 2, good: 3, excellent: 4 };

export function ShortlistView() {
  const router = useRouter();
  const [items, setItems] = useState<ShortlistItem[] | null>(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/home-material/shortlist`)
      .then(async (res) => {
        if (res.status === 401) {
          router.push(`/materials/login?returnTo=${encodeURIComponent("/materials/shortlist")}`);
          return null;
        }
        const data = await parseJsonSafe(res);
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load shortlist");
        return data;
      })
      .then((data) => data && setItems((data.items as ShortlistItem[]) ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [router]);

  async function handleRemove(productId: string) {
    setRemoving((r) => ({ ...r, [productId]: true }));
    try {
      await fetch(`/api/home-material/shortlist/${productId}`, { method: "DELETE" });
      setItems((prev) => (prev ? prev.filter((i) => i.product.id !== productId) : prev));
    } finally {
      setRemoving((r) => ({ ...r, [productId]: false }));
    }
  }

  const taxonomyByItem =
    items?.map((item) => {
      const m = item.product.material;
      return m ? MATERIAL_TAXONOMY.find((t) => t.category === m.category && t.subtype === m.subtype) : undefined;
    }) ?? [];
  const bestDurability = Math.max(-Infinity, ...taxonomyByItem.map((t) => t?.durabilityYearsApprox ?? -Infinity));
  const bestMaintenanceRank = Math.max(-Infinity, ...taxonomyByItem.map((t) => (t ? MAINTENANCE_RANK[t.maintenanceLevel] : -Infinity)));
  const bestMoistureRank = Math.max(-Infinity, ...taxonomyByItem.map((t) => (t ? MOISTURE_RANK[t.moistureLevel] : -Infinity)));
  const hasSpread = (items?.length ?? 0) > 1;

  return (
    <div className="max-w-5xl mx-auto py-10 px-6 space-y-4">
      <Link href="/materials" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Compare shortlisted materials</h1>
        <p className="text-sm text-gray-500 mt-1">
          Materials you&apos;ve saved from a room, side by side. Tap the heart on any swatch to add or remove it.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {items === null && !error && <p className="text-sm text-gray-500">Loading…</p>}

      {items?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center space-y-2">
          <p className="text-sm text-gray-500">Nothing shortlisted yet.</p>
          <Link href="/materials?openUpload=1" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
            Upload a room to start choosing materials
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, i) => {
            const t = taxonomyByItem[i];
            const durabilityIsBest = hasSpread && t != null && t.durabilityYearsApprox === bestDurability;
            const maintenanceIsBest = hasSpread && t != null && MAINTENANCE_RANK[t.maintenanceLevel] === bestMaintenanceRank;
            const moistureIsBest = hasSpread && t != null && MOISTURE_RANK[t.moistureLevel] === bestMoistureRank;
            return (
              <div key={item.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="relative h-24">
                  {item.product.textureAssetUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.product.textureAssetUrl} alt={item.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: item.product.colorHex || "#e5e7eb" }} />
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(item.product.id)}
                    disabled={removing[item.product.id]}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-gray-500 hover:text-red-500 disabled:opacity-50"
                    title="Remove from shortlist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-4 space-y-0">
                  <h3 className="text-sm font-semibold text-gray-900">{item.product.name}</h3>
                  {item.product.colorName && <p className="text-xs text-gray-400">{item.product.colorName}</p>}

                  <div className="flex items-baseline justify-between py-2 border-t border-gray-100 mt-3">
                    <span className="text-[0.68rem] font-medium uppercase tracking-wide text-gray-400">Cost</span>
                    <span className="text-sm text-gray-700">{costLabel(item.product)}</span>
                  </div>
                  <div className="flex items-baseline justify-between py-2 border-t border-gray-100">
                    <span className="text-[0.68rem] font-medium uppercase tracking-wide text-gray-400">Durability</span>
                    <span className={`text-sm ${durabilityIsBest ? "font-bold text-indigo-700" : "text-gray-700"}`}>
                      {t ? `~${t.durabilityYearsApprox} yrs` : item.product.material?.durability ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between py-2 border-t border-gray-100">
                    <span className="text-[0.68rem] font-medium uppercase tracking-wide text-gray-400">Maintenance</span>
                    <span className={`text-sm ${maintenanceIsBest ? "font-bold text-indigo-700" : "text-gray-700"}`}>
                      {t ? t.maintenanceLevel : item.product.material?.maintenance ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between py-2 border-t border-gray-100">
                    <span className="text-[0.68rem] font-medium uppercase tracking-wide text-gray-400">Moisture</span>
                    <span className={`text-sm ${moistureIsBest ? "font-bold text-indigo-700" : "text-gray-700"}`}>
                      {t ? t.moistureLevel : item.product.material?.moistureSuitability ?? "—"}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 italic mt-2 pt-2 border-t border-gray-100">
                    {item.note ? `"${item.note}"` : "No note added"}
                  </p>

                  <div className="mt-2">
                    <LeadCaptureButton productId={item.product.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

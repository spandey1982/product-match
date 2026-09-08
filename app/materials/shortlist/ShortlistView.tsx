"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { parseJsonSafe } from "@/lib/home-material/client";

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
  if (p.priceIsExact && p.priceInr != null) return `₹${p.priceInr}/sqft (retailer-listed)`;
  if (p.costRangeMinInr != null && p.costRangeMaxInr != null) return `₹${p.costRangeMinInr}–₹${p.costRangeMaxInr}/sqft (estimate)`;
  return "—";
}

const ROWS: Array<{ label: string; render: (p: ShortlistProduct) => React.ReactNode }> = [
  { label: "Material type", render: (p) => p.material?.name ?? "—" },
  { label: "Cost (material only)", render: (p) => costLabel(p) },
  { label: "Durability", render: (p) => p.material?.durability ?? "—" },
  { label: "Maintenance", render: (p) => p.material?.maintenance ?? "—" },
  { label: "Moisture suitability", render: (p) => p.material?.moistureSuitability ?? "—" },
];

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

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-4">
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
          <Link href="/materials/upload" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
            Upload a room to start choosing materials
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="w-32" />
                {items.map((item) => (
                  <th key={item.id} className="text-left align-top p-3 min-w-[180px]">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        {item.product.textureAssetUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.product.textureAssetUrl}
                            alt={item.product.name}
                            className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-lg border border-gray-200"
                            style={{ backgroundColor: item.product.colorHex || "#e5e7eb" }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(item.product.id)}
                          disabled={removing[item.product.id]}
                          className="text-gray-300 hover:text-red-500 disabled:opacity-50"
                          title="Remove from shortlist"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{item.product.name}</p>
                      {item.product.colorName && <p className="text-xs text-gray-400">{item.product.colorName}</p>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-gray-100">
                  <td className="p-3 text-xs font-medium text-gray-400 uppercase tracking-wide align-top">{row.label}</td>
                  {items.map((item) => (
                    <td key={item.id} className="p-3 text-sm text-gray-700 align-top">{row.render(item.product)}</td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-gray-100">
                <td className="p-3 text-xs font-medium text-gray-400 uppercase tracking-wide align-top">Your note</td>
                {items.map((item) => (
                  <td key={item.id} className="p-3 text-sm text-gray-500 italic align-top">{item.note || "—"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

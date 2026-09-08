import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";

export const metadata: Metadata = {
  title: "Material Guide — Home Material Intelligence",
  description: "Understand wall material types — paint, wallpaper, texture, and panels — before choosing a specific product.",
};

const CATEGORY_LABELS: Record<string, string> = {
  paint: "Paint",
  wallpaper: "Wallpaper",
  wall_texture: "Wall Texture",
  wall_panel: "Wall Panels",
};

const CATEGORY_ORDER = ["paint", "wallpaper", "wall_texture", "wall_panel"];

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-700 mt-0.5">{value}</dd>
    </div>
  );
}

export default async function MaterialGuidePage() {
  const materials = await db.hmMaterial.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: materials.filter((m) => m.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 space-y-8">
      <div>
        <Link href="/materials" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Wall material guide</h1>
        <p className="text-sm text-gray-500 mt-1">
          What type of material should you consider, before picking a specific product? Durability, maintenance, and
          cost figures below are general estimates — always confirm exact pricing and specs with a retailer.
        </p>
      </div>

      {CATEGORY_ORDER.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          {byCategory.map((g) => (
            <a
              key={g.category}
              href={`#${g.category}`}
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
            >
              {CATEGORY_LABELS[g.category] ?? g.category}
            </a>
          ))}
        </nav>
      )}

      {byCategory.map((g) => (
        <section key={g.category} id={g.category} className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">
            {CATEGORY_LABELS[g.category] ?? g.category}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {g.items.map((m) => {
              const advantages = parseArray(m.advantages);
              const limitations = parseArray(m.limitations);
              const costRange =
                m.avgCostPerSqftMinInr != null && m.avgCostPerSqftMaxInr != null
                  ? `₹${m.avgCostPerSqftMinInr}–₹${m.avgCostPerSqftMaxInr} / sq.ft (material only, estimate)`
                  : null;
              return (
                <div key={m.id} className="rounded-2xl border border-gray-200 p-4 space-y-3 bg-white">
                  <div>
                    <h3 className="font-semibold text-gray-900">{m.name}</h3>
                    {m.description && <p className="text-sm text-gray-500 mt-0.5">{m.description}</p>}
                  </div>
                  <dl className="grid grid-cols-2 gap-3">
                    <Fact label="Durability" value={m.durability} />
                    <Fact label="Maintenance" value={m.maintenance} />
                    <Fact label="Moisture suitability" value={m.moistureSuitability} />
                    <Fact label="Cost (indicative)" value={costRange} />
                  </dl>
                  {advantages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {advantages.map((a) => (
                        <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ {a}</span>
                      ))}
                    </div>
                  )}
                  {limitations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {limitations.map((l) => (
                        <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">⚠ {l}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {byCategory.length === 0 && (
        <p className="text-sm text-gray-400">No material knowledge content yet — run <code>npm run db:seed:hm-materials</code>.</p>
      )}
    </div>
  );
}

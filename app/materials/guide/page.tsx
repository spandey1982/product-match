import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { parseArray } from "@/lib/serialize";
import {
  MATERIAL_TAXONOMY,
  type MaintenanceLevel,
  type MoistureLevel,
} from "@/lib/home-material/material-taxonomy";

export const metadata: Metadata = {
  title: "Material Guide — Home Material Intelligence",
  description: "Understand wall material types — paint, wallpaper, texture, and panels — before choosing a specific product.",
};

// Reads HmMaterial live via Prisma — must never be statically prerendered
// at build time (same root cause already fixed for app/materials/page.tsx):
// the build container can't reach postgres.railway.internal, so a static
// prerender attempt here hard-fails the whole build.
export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  paint: "Paint",
  wallpaper: "Wallpaper",
  wall_texture: "Wall Texture",
  wall_panel: "Wall Panels",
};

const CATEGORY_ORDER = ["paint", "wallpaper", "wall_texture", "wall_panel"];

// Longest real durabilityYearsApprox in the taxonomy is lime plaster at 15
// years — used as the bar's full-scale reference so every material's bar
// is comparable against the same ceiling, not a per-category one.
const MAX_DURABILITY_YEARS = 15;

// maintenanceLevel/moistureLevel are ordinal, not numeric — these are
// presentation-only bar-width mappings (higher = better), not new domain
// claims; the underlying level/prose stays the source of truth.
const MAINTENANCE_BAR_PCT: Record<MaintenanceLevel, number> = { low: 85, medium: 45, high: 15 };
const MOISTURE_BAR_PCT: Record<MoistureLevel, number> = { poor: 20, fair: 45, good: 70, excellent: 90 };

function Bar({ label, pct, tail }: { label: string; pct: number; tail: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-16 shrink-0 text-right">{tail}</span>
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
    <div className="max-w-5xl mx-auto py-10 px-6">
      <Link href="/materials" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="grid lg:grid-cols-[200px_1fr] gap-10">
        <nav className="lg:sticky lg:top-6 lg:self-start flex lg:flex-col gap-1 flex-wrap">
          {byCategory.map((g) => (
            <a
              key={g.category}
              href={`#${g.category}`}
              className="text-sm px-3 py-2 rounded-lg text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {CATEGORY_LABELS[g.category] ?? g.category}
            </a>
          ))}
        </nav>

        <div className="space-y-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Wall material guide</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              What type of material should you consider, before picking a specific product? Figures below are
              general estimates — always confirm exact pricing and specs with a retailer.
            </p>
          </div>

          {byCategory.map((g) => (
            <section key={g.category} id={g.category} className="space-y-4 scroll-mt-6">
              <h2 className="text-lg font-semibold text-gray-900">{CATEGORY_LABELS[g.category] ?? g.category}</h2>
              <div className="space-y-3">
                {g.items.map((m) => {
                  const advantages = parseArray(m.advantages);
                  const limitations = parseArray(m.limitations);
                  const taxonomyEntry = MATERIAL_TAXONOMY.find((t) => t.category === m.category && t.subtype === m.subtype);
                  const costRange =
                    m.avgCostPerSqftMinInr != null && m.avgCostPerSqftMaxInr != null
                      ? `₹${m.avgCostPerSqftMinInr}–₹${m.avgCostPerSqftMaxInr} / sq.ft`
                      : null;
                  return (
                    <div key={m.id} className="grid md:grid-cols-[1fr_1.3fr] gap-6 rounded-2xl border border-gray-200 bg-white p-5">
                      <div>
                        <h3 className="font-semibold text-gray-900">{m.name}</h3>
                        {m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}
                        {(advantages.length > 0 || limitations.length > 0) && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {advantages.slice(0, 2).map((a) => (
                              <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ {a}</span>
                            ))}
                            {limitations.slice(0, 1).map((l) => (
                              <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">⚠ {l}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="md:border-l md:border-gray-100 md:pl-6 space-y-2">
                        {taxonomyEntry ? (
                          <>
                            <Bar
                              label="Durability"
                              pct={Math.min(100, Math.round((taxonomyEntry.durabilityYearsApprox / MAX_DURABILITY_YEARS) * 100))}
                              tail={`~${taxonomyEntry.durabilityYearsApprox} yrs`}
                            />
                            <Bar label="Low maintenance" pct={MAINTENANCE_BAR_PCT[taxonomyEntry.maintenanceLevel]} tail={taxonomyEntry.maintenanceLevel} />
                            <Bar label="Moisture fit" pct={MOISTURE_BAR_PCT[taxonomyEntry.moistureLevel]} tail={taxonomyEntry.moistureLevel} />
                          </>
                        ) : (
                          <>
                            {m.durability && <p className="text-xs text-gray-500"><span className="text-gray-400">Durability: </span>{m.durability}</p>}
                            {m.maintenance && <p className="text-xs text-gray-500"><span className="text-gray-400">Maintenance: </span>{m.maintenance}</p>}
                            {m.moistureSuitability && <p className="text-xs text-gray-500"><span className="text-gray-400">Moisture: </span>{m.moistureSuitability}</p>}
                          </>
                        )}
                        {costRange && (
                          <p className="text-sm text-gray-600 pt-1">
                            Indicative cost: <span className="font-medium text-gray-900">{costRange}</span>
                          </p>
                        )}
                      </div>
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
      </div>
    </div>
  );
}

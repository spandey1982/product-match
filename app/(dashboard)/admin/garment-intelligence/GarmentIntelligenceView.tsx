"use client";

import { useRef, useState } from "react";
import { thumbnailUrl } from "@/lib/images/variants";

export interface ProductRow {
  id: string;
  title: string;
  category: string;
  color: string;
  imageUrl: string | null;
  analyzedAt: string | null;
  analyzedModel: string | null;
}

interface SurfaceTechnique {
  type: string;
  relief: string;
  density: string;
  handcrafted: boolean;
  colors: string[];
  placement: string;
  stitchCharacteristics: string;
}
interface RegionObservation {
  label: string;
  technique: string;
  relief: string;
  detail: string;
  motif: string;
}
interface Intelligence {
  construction: { silhouette: string; length?: string; neckline: string; sleeves: string; details: string[] };
  surfaceTechniques: SurfaceTechnique[];
  pattern: { motifs: string[]; layout: string; scale: string };
  texture: { baseFabric: string; finish: string; drape: string };
  craftsmanship: { overallDensity: string; handcrafted: boolean; highlights: string[] };
  regions: RegionObservation[];
  confidence: string;
}
interface AnalysisResult {
  model: string;
  promptNotes: string;
  backPromptNotes?: string | null;
  intelligence: Intelligence;
  productId?: string;
}

const CATEGORIES = [
  "Kurta", "Kurti", "Saree", "Lehenga", "Blouse", "Dupatta", "Salwar",
  "Anarkali", "Sharara", "Palazzo", "Suit", "Shirt", "Other",
];

export function GarmentIntelligenceView({ products }: { products: ProductRow[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("Kurta");
  const [busyId, setBusyId] = useState<string | null>(null); // productId or "upload"
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resultLabel, setResultLabel] = useState<string>("");

  async function analyzeProduct(p: ProductRow, revalidate = false) {
    setError(null);
    setBusyId(p.id);
    try {
      // Cached row first (free) unless the admin explicitly re-analyzes.
      if (p.analyzedAt && !revalidate) {
        const res = await fetch(`/api/admin/garment-intelligence/${p.id}`);
        const data = await res.json();
        if (res.ok) {
          setResult({ ...data, productId: p.id });
          setResultLabel(p.title);
          return;
        }
      }
      const res = await fetch(`/api/admin/garment-intelligence/${p.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Analysis failed."); return; }
      setResult({ ...data, productId: p.id });
      setResultLabel(p.title);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function analyzeUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Choose a garment photo first."); return; }
    setBusyId("upload");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      const res = await fetch("/api/admin/garment-intelligence", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Analysis failed."); return; }
      setResult(data);
      setResultLabel(`${file.name} (ad-hoc, not saved)`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <h1 className="text-xl font-bold text-gray-900">Garment Intelligence</h1>
      <p className="text-sm text-gray-500 mt-1">
        R&D inspection — run the hierarchical vision analysis on any product (result is cached; repeat views are
        free) or on an uploaded photo (one-off, nothing saved). Each fresh analysis is 1–2 paid vision calls.
      </p>

      {/* ── Ad-hoc upload ─────────────────────────────────────────────────── */}
      <form onSubmit={analyzeUpload} className="mt-5 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-medium text-gray-500 mb-2">Analyze a new garment photo (no product needed)</p>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
          <select
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="submit"
            disabled={busyId !== null}
            className="rounded-xl bg-indigo-600 text-white text-sm font-medium px-4 py-2 hover:bg-indigo-700 disabled:opacity-60"
          >
            {busyId === "upload" ? "Analyzing… (~10–30s)" : "Analyze photo"}
          </button>
        </div>
      </form>

      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

      {/* ── Result ────────────────────────────────────────────────────────── */}
      {result && (
        <section className="mt-6 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{resultLabel}</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                model {result.model} · confidence {result.intelligence.confidence}
              </p>
            </div>
            {result.productId && (
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => {
                  const p = products.find((x) => x.id === result.productId);
                  if (p) analyzeProduct(p, true);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-60"
              >
                Re-analyze (paid)
              </button>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">
              Prompt notes — exactly what generation receives
            </p>
            <p className="text-sm text-emerald-900 whitespace-pre-wrap">{result.promptNotes || "(empty — nothing worth noting was detected)"}</p>
          </div>

          {result.backPromptNotes && (
            <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
              <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide mb-1">
                Back-view prompt notes — from the analyzed back image
              </p>
              <p className="text-sm text-violet-900 whitespace-pre-wrap">{result.backPromptNotes}</p>
            </div>
          )}

          {result.intelligence.surfaceTechniques.length > 0 && (
            <Block title="Surface techniques">
              <div className="grid sm:grid-cols-2 gap-2">
                {result.intelligence.surfaceTechniques.map((t, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <p className="font-semibold text-gray-900">{t.type}</p>
                    <p className="mt-0.5">relief: {t.relief} · density: {t.density} · {t.handcrafted ? "handcrafted" : "machine/flat"}</p>
                    {t.placement && <p>placement: {t.placement}</p>}
                    {t.colors.length > 0 && <p>colors: {t.colors.join(", ")}</p>}
                    {t.stitchCharacteristics && <p className="text-gray-500 mt-0.5">{t.stitchCharacteristics}</p>}
                  </div>
                ))}
              </div>
            </Block>
          )}

          {result.intelligence.regions.length > 0 && (
            <Block title="Close-up regions (hierarchical pass)">
              <div className="space-y-2">
                {result.intelligence.regions.map((r, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-700">
                    <p><span className="font-semibold text-gray-900">{r.label}</span> — {r.technique} ({r.relief})</p>
                    {r.detail && <p className="mt-0.5">{r.detail}</p>}
                    {r.motif && <p className="text-gray-500">motif: {r.motif}</p>}
                  </div>
                ))}
              </div>
            </Block>
          )}

          <div className="grid sm:grid-cols-2 gap-x-6">
            <Block title="Pattern">
              <KV k="Motifs" v={result.intelligence.pattern.motifs.join(", ")} />
              <KV k="Layout" v={result.intelligence.pattern.layout} />
              <KV k="Scale" v={result.intelligence.pattern.scale} />
            </Block>
            <Block title="Texture">
              <KV k="Base fabric" v={result.intelligence.texture.baseFabric} />
              <KV k="Finish" v={result.intelligence.texture.finish} />
              <KV k="Drape" v={result.intelligence.texture.drape} />
            </Block>
            <Block title="Construction">
              <KV k="Silhouette" v={result.intelligence.construction.silhouette} />
              <KV k="Length" v={result.intelligence.construction.length ?? ""} />
              <KV k="Neckline" v={result.intelligence.construction.neckline} />
              <KV k="Sleeves" v={result.intelligence.construction.sleeves} />
              <KV k="Details" v={result.intelligence.construction.details.join(", ")} />
            </Block>
            <Block title="Craftsmanship">
              <KV k="Overall density" v={result.intelligence.craftsmanship.overallDensity} />
              <KV k="Handcrafted" v={result.intelligence.craftsmanship.handcrafted ? "yes" : "no"} />
              <KV k="Highlights" v={result.intelligence.craftsmanship.highlights.join("; ")} />
            </Block>
          </div>
        </section>
      )}

      {/* ── Product grid ──────────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-gray-900 mt-8 mb-2">Catalogue products</h2>
      {products.length === 0 ? (
        <p className="text-sm text-gray-400">No products yet — add one from the Add Product page first.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busyId !== null}
              onClick={() => analyzeProduct(p)}
              className="text-left bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-indigo-200 disabled:opacity-60 transition-colors"
            >
              <div className="aspect-[3/4] bg-gray-50">
                {p.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumbnailUrl(p.imageUrl)} alt={p.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-900 line-clamp-2">{p.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{p.category} · {p.color}</p>
                <p className={`text-[11px] mt-1 font-medium ${busyId === p.id ? "text-amber-600" : p.analyzedAt ? "text-emerald-600" : "text-indigo-600"}`}>
                  {busyId === p.id ? "Analyzing… (~10–30s)" : p.analyzedAt ? "Analyzed — view (free)" : "Analyze (paid)"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{title}</h3>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <p className="text-xs text-gray-700 py-0.5">
      <span className="text-gray-400">{k}:</span> {v}
    </p>
  );
}

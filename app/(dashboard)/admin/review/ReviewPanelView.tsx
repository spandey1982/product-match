"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { displayUrl } from "@/lib/images/variants";

export interface ReviewRecord {
  id: string;
  productId: string | null;
  category: string;
  provider: string;
  objective: string;
  view: string;
  outputUrl: string;
  aiOverall: number | null;
  aiAuthenticity: number | null;
  aiRealism: number | null;
  aiGarmentPreservation: number | null;
  aiDrapeQuality: number | null;
  aiPatternPreservation: number | null;
  aiRenderingQuality: number | null;
  aiTextureQuality: number | null;
  aiProductVisibility: number | null;
  aiIssues: string | null;
  manualScore: number | null;
  manualReviewer: string | null;
  createdAt: string;
}

function fmt(v: number | null): string {
  return v === null || v === undefined ? "—" : v.toFixed(1);
}

/** Parse the stored JSON issues array into a string[] (tolerant of bad data). */
function parseIssues(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function Card({ record, onRated }: { record: ReviewRecord; onRated: (r: ReviewRecord) => void }) {
  const [saving, setSaving] = useState<number | null>(null);

  async function rate(score: number) {
    setSaving(score);
    try {
      const res = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, manualScore: score }),
      });
      const data = await res.json();
      if (res.ok) onRated(data.record as ReviewRecord);
    } catch {
      /* non-fatal */
    } finally {
      setSaving(null);
    }
  }

  const issues = parseIssues(record.aiIssues);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="aspect-[3/4] bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={displayUrl(record.outputUrl)} alt={record.view} className="w-full h-full object-contain" />
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-900 capitalize truncate">
            {record.category} · {record.view}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-gray-400">{record.provider}</span>
        </div>

        <div className="text-[11px] text-gray-500 leading-relaxed">
          <div className="flex justify-between"><span>AI overall</span><span className="font-medium text-gray-700">{fmt(record.aiOverall)}</span></div>
          <div className="flex justify-between"><span>Texture / Pattern</span><span>{fmt(record.aiTextureQuality)} / {fmt(record.aiPatternPreservation)}</span></div>
          <div className="flex justify-between"><span>Sharpness / Drape</span><span>{fmt(record.aiRenderingQuality)} / {fmt(record.aiDrapeQuality)}</span></div>
          <div className="flex justify-between"><span>Garment / Product vis.</span><span>{fmt(record.aiGarmentPreservation)} / {fmt(record.aiProductVisibility)}</span></div>
        </div>

        {issues.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {issues.map((iss, idx) => (
              <span key={idx} className="text-[10px] bg-amber-50 text-amber-700 rounded-full px-1.5 py-0.5">
                {iss}
              </span>
            ))}
          </div>
        )}

        <div className="pt-1">
          <p className="text-[10px] font-medium text-gray-400 mb-1">Manual rating</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => rate(n)}
                disabled={saving !== null}
                className={cn(
                  "h-7 w-7 rounded-lg text-xs font-semibold transition-all",
                  record.manualScore === n
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  saving === n && "opacity-60"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          {record.manualScore !== null && (
            <p className="text-[10px] text-emerald-600 mt-1">Rated {record.manualScore}/5</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReviewPanelView({ initialRecords }: { initialRecords: ReviewRecord[] }) {
  const [records, setRecords] = useState<ReviewRecord[]>(initialRecords);
  const [unratedOnly, setUnratedOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refresh(unrated: boolean) {
    setUnratedOnly(unrated);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/review?limit=60${unrated ? "&unrated=1" : ""}`);
      const data = await res.json();
      if (res.ok) setRecords(data.records as ReviewRecord[]);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }

  function onRated(updated: ReviewRecord) {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const rated = records.filter((r) => r.manualScore !== null).length;

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Generation Review</h1>
        <p className="text-sm text-gray-500 mt-1">
          Internal quality review — AI scores plus your manual 1–5 ratings. {rated}/{records.length} rated.
        </p>
      </div>

      <div className="flex gap-1 mb-5 p-1 bg-gray-100 rounded-xl w-fit">
        {[
          { key: false, label: "All" },
          { key: true, label: "Unrated" },
        ].map(({ key, label }) => (
          <button
            key={label}
            onClick={() => refresh(key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              unratedOnly === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-12 text-center">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">No generation records yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {records.map((r) => (
            <Card key={r.id} record={r} onRated={onRated} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface MotionReviewClip {
  id: string;
  view: string;
  presetId: string;
  sourceImageUrl: string;
  outputUrl: string | null;
  plannedHoldSec: number | null;
  productTitle: string;
  category: string;
  scores: {
    identityConsistency: number | null;
    garmentPreservation: number | null;
    textureConsistency: number | null;
    lightingStability: number | null;
    backgroundStability: number | null;
    motionSmoothness: number | null;
    artifactScore: number | null;
    overall: number | null;
  } | null;
  issues: string | null;
}

function fmt(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : v.toFixed(1);
}

function parseIssues(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function Card({ clip, onResolved }: { clip: MotionReviewClip; onResolved: (id: string) => void }) {
  const [saving, setSaving] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function resolve(action: "accept" | "reject") {
    setSaving(action);
    setError("");
    try {
      const res = await fetch(`/api/admin/motion-review/${clip.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onResolved(clip.id);
    } catch (e) {
      setError((e as Error).message);
      setSaving(null);
    }
  }

  const issues = parseIssues(clip.issues);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="aspect-[9/16] bg-gray-900">
        {clip.outputUrl ? (
          <video src={clip.outputUrl} controls loop muted className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">No output</div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-900 capitalize truncate">
            {clip.category} · {clip.view}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-gray-400">{clip.presetId}</span>
        </div>
        <p className="text-[11px] text-gray-500 truncate">{clip.productTitle}</p>
        {clip.plannedHoldSec != null && (
          <p className="text-[10px] text-gray-400">Planned hold: {clip.plannedHoldSec.toFixed(1)}s</p>
        )}

        {clip.scores && (
          <div className="text-[11px] text-gray-500 leading-relaxed">
            <div className="flex justify-between"><span>Overall</span><span className="font-medium text-gray-700">{fmt(clip.scores.overall)}</span></div>
            <div className="flex justify-between"><span>Garment / Texture</span><span>{fmt(clip.scores.garmentPreservation)} / {fmt(clip.scores.textureConsistency)}</span></div>
            <div className="flex justify-between"><span>Motion / Artifacts</span><span>{fmt(clip.scores.motionSmoothness)} / {fmt(clip.scores.artifactScore)}</span></div>
            <div className="flex justify-between"><span>Identity / Lighting</span><span>{fmt(clip.scores.identityConsistency)} / {fmt(clip.scores.lightingStability)}</span></div>
          </div>
        )}

        {issues.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {issues.map((iss, idx) => (
              <span key={idx} className="text-[10px] bg-amber-50 text-amber-700 rounded-full px-1.5 py-0.5">
                {iss}
              </span>
            ))}
          </div>
        )}

        {error && <p className="text-[10px] text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => resolve("accept")}
            disabled={saving !== null}
            className={cn(
              "flex-1 h-8 rounded-lg text-xs font-semibold transition-all",
              "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
              saving === "accept" && "opacity-60"
            )}
          >
            {saving === "accept" ? "Accepting…" : "Accept"}
          </button>
          <button
            onClick={() => resolve("reject")}
            disabled={saving !== null}
            className={cn(
              "flex-1 h-8 rounded-lg text-xs font-semibold transition-all",
              "bg-red-50 text-red-700 hover:bg-red-100",
              saving === "reject" && "opacity-60"
            )}
          >
            {saving === "reject" ? "Rejecting…" : "Reject & retry"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MotionReviewView({ initialClips }: { initialClips: MotionReviewClip[] }) {
  const [clips, setClips] = useState<MotionReviewClip[]>(initialClips);

  function onResolved(id: string) {
    setClips((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Catalogue Motion Review</h1>
        <p className="text-sm text-gray-500 mt-1">
          Clips QA couldn&apos;t confidently accept or reject. {clips.length} pending.
        </p>
      </div>

      {clips.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">Nothing pending review.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {clips.map((c) => (
            <Card key={c.id} clip={c} onResolved={onResolved} />
          ))}
        </div>
      )}
    </div>
  );
}

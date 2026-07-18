"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Wand2, Plus, ChevronRight, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DesignSummary {
  id: string;
  title: string;
  garmentType: string;
  stage: string;
  flatFrontUrl: string | null;
  qualityScore: number | null;
  createdAt: string;
}

const STAGE_LABELS: Record<string, string> = {
  uploading:               "Uploading",
  analyzing_fabric:        "Analysing Fabric",
  analyzing_design:        "Analysing Design",
  analyzing_accessories:   "Analysing Accessories",
  planning:                "Planning",
  constructing:            "Constructing",
  generating_flat_images:  "Generating Images",
  completed:               "Completed",
  failed:                  "Failed",
};

const STAGE_COLORS: Record<string, string> = {
  uploading:               "bg-gray-100 text-gray-600",
  analyzing_fabric:        "bg-blue-100 text-blue-700",
  analyzing_design:        "bg-indigo-100 text-indigo-700",
  analyzing_accessories:   "bg-purple-100 text-purple-700",
  planning:                "bg-cyan-100 text-cyan-700",
  constructing:            "bg-amber-100 text-amber-700",
  generating_flat_images:  "bg-orange-100 text-orange-700",
  completed:               "bg-emerald-100 text-emerald-700",
  failed:                  "bg-red-100 text-red-600",
};

export function DesignLibrary() {
  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fashion-designer/designs")
      .then((r) => r.json())
      .then((d) => setDesigns(d.designs ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this design? This cannot be undone.")) return;
    setDeletingId(id);
    await fetch(`/api/fashion-designer/designs/${id}`, { method: "DELETE" });
    setDesigns((prev) => prev.filter((d) => d.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 [padding-bottom:calc(5rem+env(safe-area-inset-bottom))] md:[padding-bottom:2rem]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-purple-600" />
            Design Studio
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Design garments from raw fabric and references
          </p>
        </div>
        {/* Desktop — inline button */}
        <Link href="/fashion-designer/new" className="hidden md:block">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Design
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      ) : designs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
            <Wand2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No designs yet</h2>
          <p className="text-sm text-gray-500 max-w-xs mb-6">
            Upload fabric images and let the AI design and visualise your garment from scratch.
          </p>
          <Link href="/fashion-designer/new">
            <Button className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Create your first design
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {designs.map((d) => (
            <Link key={d.id} href={`/fashion-designer/${d.id}`} className="group block">
              <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:border-purple-100 transition-all duration-200 hover:-translate-y-0.5">
                {/* Thumbnail */}
                <div className="relative aspect-[3/4] bg-gray-50">
                  {d.flatFrontUrl ? (
                    <Image
                      src={d.flatFrontUrl}
                      alt={d.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Wand2 className="h-10 w-10 text-gray-200" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STAGE_COLORS[d.stage] ?? "bg-gray-100 text-gray-600"}`}>
                      {STAGE_LABELS[d.stage] ?? d.stage}
                    </span>
                  </div>
                </div>
                {/* Info */}
                <div className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                    <p className="text-xs text-gray-400 truncate">{d.garmentType || "Garment"}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, d.id)}
                    disabled={deletingId === d.id}
                    className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete design"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Mobile FAB — same gradient treatment as the Trial Room FAB */}
      <Link
        href="/fashion-designer/new"
        className="fixed right-6 z-30 flex items-center gap-2 h-12 px-5 rounded-2xl text-sm font-semibold text-white shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 hover:shadow-xl active:scale-95 transition-all md:hidden [bottom:max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]"
      >
        <Plus className="h-4 w-4" />
        New Design
      </Link>
    </div>
  );
}

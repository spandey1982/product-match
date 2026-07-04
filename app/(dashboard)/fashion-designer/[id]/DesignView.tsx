"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Wand2, RefreshCw, ArrowLeft, CheckCircle2, Circle, Loader2, XCircle, X, ZoomIn, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FabricAnalysis, DesignUnderstanding, GenerationPlan, AccessoryAnalysis } from "@/lib/fashion-designer/types";
import { findTemplate, fieldOptionLabel } from "@/lib/fashion-designer/templates";

type DesignStage =
  | "uploading" | "analyzing_fabric" | "analyzing_design" | "analyzing_accessories"
  | "planning" | "constructing" | "generating_flat_images" | "completed" | "failed";

interface Design {
  id: string;
  title: string;
  garmentType: string;
  templateId: string | null;
  structuredOptions: string | null;
  designNotes: string | null;
  stage: DesignStage;
  fabricAnalysis: string | null;
  designUnderstanding: string | null;
  accessoryAnalysis: string | null;
  generationPlan: string | null;
  flatFrontUrl: string | null;
  flatBackUrl: string | null;
  qualityScore: number | null;
  failureReason: string | null;
}

const PIPELINE_STAGES: { key: DesignStage; label: string }[] = [
  { key: "uploading",              label: "Uploading Assets" },
  { key: "analyzing_fabric",       label: "Understanding Fabric" },
  { key: "analyzing_design",       label: "Understanding Design" },
  { key: "analyzing_accessories",  label: "Understanding Accessories" },
  { key: "planning",               label: "Planning Garment" },
  { key: "constructing",           label: "Constructing Garment" },
  { key: "generating_flat_images", label: "Generating Flat Images" },
  { key: "completed",              label: "Ready" },
];

const STAGE_ORDER = PIPELINE_STAGES.map((s) => s.key);

function stageIndex(stage: DesignStage) {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx === -1 ? 0 : idx;
}

function PipelineProgress({ stage }: { stage: DesignStage }) {
  const current = stageIndex(stage);
  const failed = stage === "failed";

  return (
    <div className="space-y-3">
      {PIPELINE_STAGES.map((s, i) => {
        const done = current > i;
        const active = current === i && !failed;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className="shrink-0">
              {failed && active ? (
                <XCircle className="h-5 w-5 text-red-500" />
              ) : done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : active ? (
                <Loader2 className="h-5 w-5 text-purple-500 animate-spin" />
              ) : (
                <Circle className="h-5 w-5 text-gray-200" />
              )}
            </div>
            <span className={`text-sm ${done ? "text-gray-700 font-medium" : active ? "text-purple-700 font-semibold" : "text-gray-400"}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AnalysisCard({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {Object.entries(data)
          .filter(([, v]) => v && v !== "None" && v !== "Unknown" && v !== "")
          .map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
                {k.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <span className="text-xs text-gray-800 font-medium">{String(v)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export function DesignView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [design, setDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [addingToCatalog, setAddingToCatalog] = useState(false);
  const [catalogProductId, setCatalogProductId] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/fashion-designer/designs/${id}`);
      if (!res.ok) return;
      const data = await res.json() as { design: Design };
      setDesign(data.design);
      if (data.design.stage === "completed" || data.design.stage === "failed") {
        clearInterval(pollRef.current!);
      }
    }, 3000);
  }

  // On mount: load design, then trigger pipeline if it hasn't run yet
  useEffect(() => {
    async function init() {
      const res = await fetch(`/api/fashion-designer/designs/${id}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json() as { design: Design };
      setDesign(data.design);
      setLoading(false);

      if (data.design.stage === "uploading" && !processingRef.current) {
        processingRef.current = true;
        startPolling();
        await fetch(`/api/fashion-designer/designs/${id}/process`, { method: "POST" });
      } else if (
        data.design.stage !== "completed" &&
        data.design.stage !== "failed"
      ) {
        startPolling();
      }
    }
    void init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddToCatalog() {
    setAddingToCatalog(true);
    const res = await fetch(`/api/fashion-designer/designs/${id}/add-to-catalog`, { method: "POST" });
    const data = await res.json() as { productId?: string; error?: string };
    if (data.productId) {
      setCatalogProductId(data.productId);
    }
    setAddingToCatalog(false);
  }

  async function handleRegenerate() {
    setShowRegenerateModal(false);
    setRegenerating(true);
    startPolling();
    await fetch(`/api/fashion-designer/designs/${id}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designNotes: regenerateFeedback.trim() || undefined }),
    });
    setRegenerating(false);
    setRegenerateFeedback("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!design) {
    return <div className="text-center py-24 text-gray-500">Design not found.</div>;
  }

  const template = findTemplate(design.templateId);
  const structuredOptions = design.structuredOptions
    ? (JSON.parse(design.structuredOptions) as Record<string, string>)
    : {};

  const fabricAnalysis = design.fabricAnalysis ? JSON.parse(design.fabricAnalysis) as FabricAnalysis : null;
  const designUnderstanding = design.designUnderstanding ? JSON.parse(design.designUnderstanding) as DesignUnderstanding : null;
  const accessoryAnalysis = design.accessoryAnalysis ? JSON.parse(design.accessoryAnalysis) as AccessoryAnalysis : null;
  const generationPlan = design.generationPlan ? JSON.parse(design.generationPlan) as GenerationPlan : null;

  const isRunning = design.stage !== "completed" && design.stage !== "failed";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/fashion-designer")} className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-600" />
              {design.title}
            </h1>
            <p className="text-sm text-gray-500">{design.garmentType}</p>
          </div>
        </div>
        {design.stage === "completed" && (
          <div className="flex items-center gap-2">
            {catalogProductId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/products/${catalogProductId}`)}
                className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                View in Catalog
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddToCatalog}
                loading={addingToCatalog}
                className="gap-1.5"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Add to Catalog
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateModal(true)}
              loading={regenerating}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pipeline progress */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Pipeline</h2>
            <PipelineProgress stage={design.stage} />
            {design.stage === "failed" && design.failureReason && (
              <div className="mt-4 p-3 bg-red-50 rounded-xl">
                <p className="text-xs text-red-600 font-medium">Error</p>
                <p className="text-xs text-red-500 mt-0.5">{design.failureReason}</p>
              </div>
            )}
            {isRunning && (
              <p className="text-xs text-gray-400 mt-4 text-center">
                This may take 1–3 minutes...
              </p>
            )}
          </div>

          {/* Template & customization */}
          {template && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">{template.label}</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {template.fields.map((f) => (
                  <div key={f.key} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
                      {f.label}
                    </span>
                    <span className="text-xs text-gray-800 font-medium">
                      {fieldOptionLabel(f, structuredOptions[f.key] ?? f.default)}
                    </span>
                  </div>
                ))}
              </div>
              {design.designNotes && (
                <p className="text-xs text-gray-500 pt-2 border-t border-gray-50">{design.designNotes}</p>
              )}
            </div>
          )}

          {/* Fabric analysis */}
          {fabricAnalysis && (
            <AnalysisCard title="Fabric Analysis" data={fabricAnalysis as unknown as Record<string, unknown>} />
          )}

          {/* Design understanding */}
          {designUnderstanding && (
            <AnalysisCard title="Design Understanding" data={designUnderstanding as unknown as Record<string, unknown>} />
          )}

          {/* Accessory analysis */}
          {accessoryAnalysis && accessoryAnalysis.items.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Accessories ({accessoryAnalysis.items.length})</h3>
              {accessoryAnalysis.items.map((item, i) => (
                <div key={i} className="text-xs space-y-0.5 border-t border-gray-50 pt-2 first:border-0 first:pt-0">
                  <p className="font-medium text-gray-800">{item.type} · {item.color}</p>
                  <p className="text-gray-400">{item.dimensions} · {item.placementSuggestion}</p>
                </div>
              ))}
            </div>
          )}

          {/* Generation plan summary */}
          {generationPlan && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Generation Plan</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{generationPlan.garmentDescription}</p>
              {generationPlan.accessoryPlacement && generationPlan.accessoryPlacement !== "None" && (
                <p className="text-xs text-gray-400">{generationPlan.accessoryPlacement}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Generated images */}
        <div className="lg:col-span-2 space-y-4">
          {/* Regenerate feedback modal */}
          {showRegenerateModal && (
            <div
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
              onClick={() => setShowRegenerateModal(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">Regeneration Instructions</h2>
                  <button onClick={() => setShowRegenerateModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-500">
                  Describe what&apos;s wrong and what the AI should do differently. Leave blank to regenerate with the same settings.
                </p>
                <textarea
                  autoFocus
                  value={regenerateFeedback}
                  onChange={(e) => setRegenerateFeedback(e.target.value)}
                  placeholder="e.g. The sleeves should be 3/4 length, not full. The collar needs to be a mandarin style. The back should have a box pleat."
                  rows={5}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowRegenerateModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRegenerate}
                    className="gap-1.5 bg-purple-600 hover:bg-purple-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Lightbox */}
          {lightbox && (
            <div
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
              onClick={() => setLightbox(null)}
            >
              <button
                className="absolute top-4 right-4 text-white/70 hover:text-white"
                onClick={() => setLightbox(null)}
              >
                <X className="h-7 w-7" />
              </button>
              <div className="relative max-w-2xl w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <p className="text-white/60 text-xs uppercase tracking-wide mb-2">{lightbox.label}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lightbox.url} alt={lightbox.label} className="w-full h-auto max-h-[85vh] object-contain rounded-2xl" />
              </div>
            </div>
          )}

          {design.stage === "completed" && !design.flatFrontUrl && !design.flatBackUrl ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed border-orange-100 bg-orange-50/20">
              <XCircle className="h-10 w-10 text-orange-300 mb-4" />
              <p className="text-sm font-medium text-gray-600">Image generation failed — analysis is complete</p>
              <p className="text-xs text-gray-400 mt-1">Try regenerating to retry the image step</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleRegenerate} loading={regenerating}>
                Regenerate
              </Button>
            </div>
          ) : design.stage === "completed" && (design.flatFrontUrl || design.flatBackUrl) ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900">Generated Garment</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {design.flatFrontUrl && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Front View</p>
                    <button
                      onClick={() => setLightbox({ url: design.flatFrontUrl!, label: "Front View" })}
                      className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 group block"
                    >
                      <Image
                        src={design.flatFrontUrl}
                        alt="Front view"
                        fill
                        className="object-contain"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </div>
                    </button>
                  </div>
                )}
                {design.flatBackUrl && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Back View</p>
                    <button
                      onClick={() => setLightbox({ url: design.flatBackUrl!, label: "Back View" })}
                      className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 group block"
                    >
                      <Image
                        src={design.flatBackUrl}
                        alt="Back view"
                        fill
                        className="object-contain"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : isRunning ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed border-purple-100 bg-purple-50/20">
              <Loader2 className="h-10 w-10 text-purple-400 animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-600">AI is designing your garment...</p>
              <p className="text-xs text-gray-400 mt-1">Results will appear here automatically</p>
            </div>
          ) : design.stage === "failed" ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed border-red-100 bg-red-50/20">
              <XCircle className="h-10 w-10 text-red-300 mb-4" />
              <p className="text-sm font-medium text-gray-600">Generation failed</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleRegenerate}
                loading={regenerating}
              >
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

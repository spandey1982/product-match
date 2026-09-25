"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, AlertCircle, RotateCcw, CheckCircle2, XCircle, History, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CANVASES } from "@/lib/marketing-creative/canvas";
import type { CanvasKey } from "@/lib/marketing-creative/types";

export interface ProductPreview {
  id: string;
  title: string;
  hasDiscount: boolean;
  previewUrl: string | null;
}

interface RenderedOutput {
  aspectRatio: CanvasKey;
  url: string;
  width: number;
  height: number;
}

interface MarketingCreativeJob {
  id: string;
  status: "queued" | "resolving_hero" | "rendering" | "complete" | "failed";
  heroSourceMode: string;
  templateFamily: string;
  contentMode: string;
  objective: string;
  aspectRatios: string;
  outputs: string;
  errorMessage: string | null;
  createdAt: string;
  retryCount: number;
}

const TEMPLATE_FAMILY_OPTIONS: { value: string; label: string; description: string; recommended?: boolean }[] = [
  {
    value: "promo-benefits",
    label: "Promo Benefits",
    description: "Feature rows, price banner, trust badges — dense and detail-forward. Best for most retailers.",
    recommended: true,
  },
  {
    value: "hero-editorial",
    label: "Hero Editorial",
    description: "Minimal, photography-first, no price shown. Best for premium/luxury or bridal-tier positioning.",
  },
  {
    value: "styled-promo",
    label: "Styled Promo",
    description: "Full-bleed photo with a title and visible price — between the two above.",
  },
];

const OBJECTIVE_OPTIONS = [
  { value: "discovery", label: "Product discovery / new arrival" },
  { value: "price_promotion", label: "Price / sale promotion" },
  { value: "seasonal_occasion", label: "Seasonal / occasion" },
];

const CONTENT_MODE_OPTIONS = [
  { value: "", label: "Auto — decide from objective + brand profile" },
  { value: "aspirational", label: "Aspirational — no price shown" },
  { value: "price-led", label: "Price-led — price/discount shown" },
];

const HERO_SOURCE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "auto", label: "Auto", description: "Chosen from brand tier, price visibility, category and occasion — see research/catalogue-to-campaign.html." },
  { value: "reuse-catalogue", label: "Reuse catalogue photo", description: "Uses the product's existing generated photo. Fastest, no extra AI cost." },
  { value: "generate-new", label: "Generate new image", description: "Generates a fresh scene for this creative. A real paid AI call — takes longer." },
  { value: "product-only", label: "Product only", description: "No model — just the product/article itself." },
];

const ASPECT_RATIO_OPTIONS = Object.values(CANVASES);

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function friendlyError(message: string | null): string {
  if (message === "no_source_image_available") return "No product image is available to build a creative from yet.";
  if (message === "insufficient_credits") return "Not enough credits to generate this creative.";
  return message ?? "Something went wrong — please try again.";
}

const POLL_INTERVAL_MS = 4000;
const QUEUED_STALL_WARNING_SEC = 45;

function JobResult({ job }: { job: MarketingCreativeJob }) {
  const outputs = parseJsonArray<RenderedOutput>(job.outputs);
  if (outputs.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {outputs.map((o) => (
        <a
          key={o.aspectRatio}
          href={o.url}
          download
          className="group relative rounded-xl overflow-hidden border border-gray-100 block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.url} alt={o.aspectRatio} className="w-full h-auto" />
          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-2 py-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
            <span>{CANVASES[o.aspectRatio]?.label ?? o.aspectRatio}</span>
            <Download className="h-3 w-3" />
          </div>
        </a>
      ))}
    </div>
  );
}

export function CreativeStudioView({
  product,
  initialHistory = [],
}: {
  product: ProductPreview | null;
  initialHistory?: MarketingCreativeJob[];
}) {
  const [objective, setObjective] = useState(product?.hasDiscount ? "price_promotion" : "discovery");
  const [templateFamily, setTemplateFamily] = useState("promo-benefits");
  const [contentMode, setContentMode] = useState("");
  const [heroSourceMode, setHeroSourceMode] = useState("auto");
  const [aspectRatios, setAspectRatios] = useState<Set<CanvasKey>>(new Set(["square"]));
  const [job, setJob] = useState<MarketingCreativeJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [history, setHistory] = useState<MarketingCreativeJob[]>(initialHistory);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  useEffect(() => {
    const isBusy = job && job.status !== "complete" && job.status !== "failed";
    if (!isBusy) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => setNowTick(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [job]);

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/marketing-creative/jobs/${jobId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { job: MarketingCreativeJob };
      setJob(data.job);
      if (data.job.status === "complete" || data.job.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setHistory((prev) => prev.map((h) => (h.id === data.job.id ? data.job : h)));
      }
    }, POLL_INTERVAL_MS);
  }

  function toggleAspectRatio(key: CanvasKey) {
    setAspectRatios((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // always keep at least one selected
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleGenerate() {
    if (!product) return;
    setSubmitting(true);
    setSubmitError(null);
    setJob(null);
    try {
      const res = await fetch("/api/marketing-creative/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          objective,
          templateFamily,
          contentMode: contentMode || undefined,
          heroSourceMode,
          aspectRatios: [...aspectRatios],
        }),
      });
      const data = (await res.json()) as { job?: MarketingCreativeJob; error?: string };
      if (!res.ok || !data.job) {
        setSubmitError(data.error ?? "Failed to start generation");
        return;
      }
      setJob(data.job);
      setHistory((prev) => [data.job as MarketingCreativeJob, ...prev]);
      if (data.job.status !== "complete" && data.job.status !== "failed") {
        startPolling(data.job.id);
      }
    } catch {
      setSubmitError("Failed to start generation");
    } finally {
      setSubmitting(false);
    }
  }

  if (!product) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Marketing Creative</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Open this from a product you want a marketing creative for — go to the product&apos;s page, tap the{" "}
          <span className="font-medium text-gray-700">⋮</span> menu in the top right, and choose{" "}
          <span className="font-medium text-gray-700">Create Marketing Creative</span>.
        </p>
        <Link
          href="/catalog?pick=marketing-creative"
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Browse catalogue <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const isBusy = job && job.status !== "complete" && job.status !== "failed";

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Marketing Creative</h1>
        <p className="text-sm text-gray-500">
          A ready-to-post marketing image for <span className="font-medium text-gray-700">{product.title}</span> — price, logo and CTA are always rendered exactly from your product data, never invented by AI.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {product.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.previewUrl} alt={product.title} className="w-full max-w-[220px] mx-auto rounded-xl border border-gray-100" />
          ) : (
            <div className="text-xs text-center text-gray-500 bg-gray-50 border border-gray-200 rounded-xl py-3 px-4">
              No product photo yet — that&apos;s fine, choose &quot;Generate new image&quot; below.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Template</label>
            <div className="space-y-2">
              {TEMPLATE_FAMILY_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors",
                    templateFamily === o.value ? "border-indigo-300 bg-indigo-50/60" : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    name="templateFamily"
                    value={o.value}
                    checked={templateFamily === o.value}
                    onChange={() => setTemplateFamily(o.value)}
                    disabled={!!isBusy}
                    className="mt-0.5"
                  />
                  {/* min-w-0 — without it, a flex row's child never shrinks
                      below its text content's natural (unwrapped) width, so
                      a long description just runs off the edge of a narrow
                      viewport instead of wrapping. Confirmed the actual
                      cause of the off-screen overflow on a real phone
                      (2026-09-25) — the shell's own width wasn't the whole
                      story, this flexbox default was too. */}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 flex items-center gap-1.5 flex-wrap">
                      {o.label}
                      {o.recommended && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-100 rounded px-1.5 py-0.5">
                          Recommended
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{o.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Select label="Objective" value={objective} onChange={(e) => setObjective(e.target.value)} options={OBJECTIVE_OPTIONS} disabled={!!isBusy} />
          <Select label="Content mode" value={contentMode} onChange={(e) => setContentMode(e.target.value)} options={CONTENT_MODE_OPTIONS} disabled={!!isBusy} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Canvases</label>
            <div className="flex flex-wrap gap-3">
              {ASPECT_RATIO_OPTIONS.map((c) => (
                <label key={c.key} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={aspectRatios.has(c.key)}
                    onChange={() => toggleAspectRatio(c.key)}
                    disabled={!!isBusy}
                    className="rounded border-gray-300"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hero image source</label>
            <div className="space-y-2">
              {HERO_SOURCE_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors",
                    heroSourceMode === o.value ? "border-indigo-300 bg-indigo-50/60" : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    name="heroSourceMode"
                    value={o.value}
                    checked={heroSourceMode === o.value}
                    onChange={() => setHeroSourceMode(o.value)}
                    disabled={!!isBusy}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{o.label}</p>
                    <p className="text-xs text-gray-500">{o.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={submitting || !!isBusy} className="w-full gap-1.5">
            {submitting || isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isBusy ? "Generating…" : "Generate Marketing Creative"}
          </Button>

          {submitError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}
        </CardContent>
      </Card>

      {job && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {job.status === "failed" ? (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {friendlyError(job.errorMessage)}
              </div>
            ) : job.status === "complete" ? (
              <>
                <JobResult job={job} />
                <p className="text-xs text-center text-gray-400">
                  {job.templateFamily} · sourced as <span className="font-medium text-gray-600">{job.heroSourceMode}</span>
                </p>
                <Button variant="outline" onClick={handleGenerate} className="w-full gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Generate Another
                </Button>
              </>
            ) : (
              (() => {
                const elapsedSec = Math.max(0, Math.round((nowTick - new Date(job.createdAt).getTime()) / 1000));
                const stalled = job.status === "queued" && elapsedSec > QUEUED_STALL_WARNING_SEC;
                return (
                  <>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {job.status === "rendering"
                        ? `Rendering — ${formatElapsed(elapsedSec)} elapsed`
                        : `Queued — ${formatElapsed(elapsedSec)} elapsed`}
                      {job.retryCount > 0 && <span className="text-gray-400">· retry {job.retryCount}</span>}
                    </div>
                    {stalled && (
                      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        This is taking longer than usual to even start rendering. If it stays like this, the background job processor may not be running.
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </CardContent>
        </Card>
      )}

      {(() => {
        const pastList = history.filter((h) => h.id !== job?.id);
        if (pastList.length === 0) return null;
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <History className="h-4 w-4" /> Previous generations
            </div>
            <div className="space-y-3">
              {pastList.map((h) => (
                <Card key={h.id}>
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{formatDate(h.createdAt)}</span>
                      {h.status === "complete" ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                        </span>
                      ) : h.status === "failed" ? (
                        <span className="flex items-center gap-1 text-red-500">
                          <XCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {h.status}
                        </span>
                      )}
                    </div>
                    {h.status === "complete" ? <JobResult job={h} /> : h.status === "failed" ? (
                      <p className="text-xs text-red-500">{friendlyError(h.errorMessage)}</p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

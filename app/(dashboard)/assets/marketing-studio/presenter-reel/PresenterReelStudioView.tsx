"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, AlertCircle, RotateCcw, CheckCircle2, XCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

export interface ProductPreview {
  id: string;
  title: string;
  previewUrl: string | null;
}

export interface PersonaOption {
  id: string;
  name: string;
}

interface PresenterReelJob {
  id: string;
  status: "queued" | "scripting" | "rendering" | "complete" | "failed";
  script: string;
  videoUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  retryCount: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const POLL_INTERVAL_MS = 4000;
// Every successful generation observed so far has rendered in 60–90s once
// picked up — used only to phrase an honest "usually/typically" estimate,
// never a guarantee.
const TYPICAL_RENDER_SEC = 75;
// Past this many seconds still queued (not yet rendering), something is
// probably actually wrong rather than just a normal wait — in practice this
// has meant the background job processor (a separate `npm run worker:motion`
// process, not the web server) isn't running at all.
const QUEUED_STALL_WARNING_SEC = 45;

function friendlyError(message: string | null): string {
  if (message === "insufficient_credits") return "Not enough credits to generate this video.";
  return message ?? "Something went wrong — please try again.";
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export function PresenterReelStudioView({
  product,
  personas,
  initialHistory = [],
}: {
  product: ProductPreview | null;
  personas: PersonaOption[];
  initialHistory?: PresenterReelJob[];
}) {
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "");
  const [job, setJob] = useState<PresenterReelJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [history, setHistory] = useState<PresenterReelJob[]>(initialHistory);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // A separate 1s ticker (distinct from the 4s status poll) purely so the
  // elapsed-time display counts up smoothly instead of jumping every 4s.
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
      const res = await fetch(`/api/presenter-reel/jobs/${jobId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { job: PresenterReelJob };
      setJob(data.job);
      if (data.job.status === "complete" || data.job.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setHistory((prev) => prev.map((h) => (h.id === data.job.id ? data.job : h)));
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleGenerate() {
    if (!product || !personaId) return;
    setSubmitting(true);
    setSubmitError(null);
    setJob(null);
    try {
      const res = await fetch("/api/presenter-reel/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, personaId }),
      });
      const data = (await res.json()) as { job?: PresenterReelJob; error?: string };
      if (!res.ok || !data.job) {
        setSubmitError(data.error ?? "Failed to start generation");
        return;
      }
      setJob(data.job);
      setHistory((prev) => [data.job as PresenterReelJob, ...prev]);
      startPolling(data.job.id);
    } catch {
      setSubmitError("Failed to start generation");
    } finally {
      setSubmitting(false);
    }
  }

  if (!product) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Presenter Reel</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Open this from a product you want to generate a marketing video for — go to the product&apos;s page, tap the{" "}
          <span className="font-medium text-gray-700">⋮</span> menu in the top right, and choose{" "}
          <span className="font-medium text-gray-700">Create Marketing Video</span>.
        </p>
      </div>
    );
  }

  const isBusy = job && job.status !== "complete" && job.status !== "failed";

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Presenter Reel</h1>
        <p className="text-sm text-gray-500">
          An AI presenter introduces <span className="font-medium text-gray-700">{product.title}</span> on camera — a short talking marketing video, not a silent catalogue clip.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {product.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.previewUrl} alt={product.title} className="w-full max-w-[220px] mx-auto rounded-xl border border-gray-100" />
          ) : (
            <div className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-xl py-3 px-4">
              No generated on-model photo exists for this product yet — generate one first (Product page → ⋮ → Generate Model Image), then come back here.
            </div>
          )}

          <Select
            label="Presenter"
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            options={personas.map((p) => ({ value: p.id, label: p.name }))}
            disabled={!!isBusy}
          />

          <Button onClick={handleGenerate} disabled={submitting || !!isBusy || !product.previewUrl} className="w-full gap-1.5">
            {submitting || isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isBusy ? "Generating…" : "Generate Presenter Reel"}
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
            ) : job.status === "complete" && job.videoUrl ? (
              <>
                <video src={job.videoUrl} controls className="w-full max-w-[220px] mx-auto rounded-xl border border-gray-100" />
                <p className="text-xs text-center text-gray-400">
                  Every generated video carries a visible &quot;AI-generated content&quot; label — required disclosure, not optional.
                </p>
                <p className="text-xs text-gray-500 italic text-center">&quot;{job.script}&quot;</p>
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
                        ? `Rendering — ${formatElapsed(elapsedSec)} elapsed (usually ${TYPICAL_RENDER_SEC}s once it starts)`
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
                    {h.status === "complete" && h.videoUrl ? (
                      <video src={h.videoUrl} controls className="w-full max-w-[180px] mx-auto rounded-xl border border-gray-100" />
                    ) : h.status === "failed" ? (
                      <p className="text-xs text-red-500">{friendlyError(h.errorMessage)}</p>
                    ) : null}
                    {h.script && <p className="text-xs text-gray-500 italic">&quot;{h.script}&quot;</p>}
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

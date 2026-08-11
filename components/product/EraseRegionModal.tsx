"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eraser, Undo2, RotateCcw, History, Check } from "lucide-react";
import type { PartImage } from "@/lib/product/part-slots";

interface Point {
  x: number;
  y: number;
}
interface Stroke {
  points: Point[];
  size: number;
  /** True when the stroke's end landed back near its start — a traced boundary, filled solid rather than left as a thin outline. */
  closed: boolean;
}

export interface EraseTargetImage {
  id: string;
  url: string;
  previousUrl?: string | null;
}

export interface EraseRegionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  image: EraseTargetImage | null;
  partImages: PartImage[];
  /** Fired after a successful edit or revert — parent patches its own image list. */
  onUpdated: (imageId: string, newUrl: string, previousUrl: string | null) => void;
  /** Fired once the retailer finalizes — parent patches whichever crop cards the cascade regenerated. */
  onFinalized: (updates: Array<{ view: string; url: string }>) => void;
}

/**
 * Mask-painting + correction modal for the erase/fix-region feature
 * (docs/research/SESSION_HANDOFF_2026-08-08.md priority #2).
 *
 * The canvas's INTERNAL resolution is set to the displayed image's natural
 * (source) pixel size, so the exported mask PNG is already at the same
 * resolution the backend fetches for editing — no coordinate translation is
 * needed server-side. Everything outside the painted region is guaranteed
 * unchanged by the backend's post-generation composite (lib/model-gen/erase.ts),
 * not by how well the model itself respects the mask — so this UI's only job
 * is to capture where the retailer wants to change, not to be pixel-perfect.
 */
export function EraseRegionModal({ open, onOpenChange, productId, image, partImages, onUpdated, onFinalized }: EraseRegionModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const lastPointRef = useRef<Point | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [brushSize, setBrushSize] = useState(60);
  const [correctionText, setCorrectionText] = useState("");
  const [referenceSlot, setReferenceSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh state per target image comes from the parent keying this component
  // by image.id (a different image → a whole new mounted instance, no effect
  // needed). Reopening the SAME image after a submit/revert still needs an
  // explicit reset since the id doesn't change — done inline in
  // handleSubmit/handleRevert's success paths below, not here.

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes) {
      if (!stroke || stroke.points.length === 0) continue;
      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
      if (stroke.closed) {
        // A traced boundary — fill the enclosed interior solid, not just the
        // outline. Also stroke the same path so the boundary itself (where
        // the cursor actually was) is fully covered, not left half-inside
        // the fill edge.
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function handleImageLoad() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    setBrushSize(Math.max(12, Math.round(img.naturalWidth * 0.03)));
    redraw();
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    drawingRef.current = { points: [p], size: brushSize, closed: false };
    lastPointRef.current = p;
    // Draw the initial dot immediately so a tap (no drag) still registers.
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastPointRef.current) return;
    const p = pointFromEvent(e);
    drawingRef.current.points.push(p);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastPointRef.current = p;
  }

  function finishStroke() {
    // Capture and clear the ref BEFORE calling setStrokes — its updater runs
    // lazily (whenever React processes the update), by which point
    // `drawingRef.current` would already be null if read directly inside the
    // closure, pushing a literal `null` into `strokes` and crashing redraw().
    const finished = drawingRef.current;
    drawingRef.current = null;
    lastPointRef.current = null;
    if (finished && finished.points.length > 0) {
      // A traced boundary — the end landed back near the start — fills its
      // interior instead of staying a thin outline (see redraw()). Threshold
      // scales with brush size: a coarser brush implies coarser precision.
      if (finished.points.length >= 3) {
        const first = finished.points[0];
        const last = finished.points[finished.points.length - 1];
        const dist = Math.hypot(last.x - first.x, last.y - first.y);
        finished.closed = dist <= Math.max(finished.size * 2, 20);
      }
      setStrokes((prev) => [...prev, finished]);
    }
  }

  function handleUndo() {
    setStrokes((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setStrokes([]);
  }

  async function handleSubmit() {
    if (!image || !canvasRef.current) return;
    if (strokes.length === 0) {
      setError("Paint the region you want to fix first.");
      return;
    }
    if (!correctionText.trim() && !referenceSlot) {
      setError("Describe the correction, or pick a reference photo, before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const maskDataUrl = canvasRef.current.toDataURL("image/png");
      const res = await fetch(`/api/products/${productId}/images/${image.id}/erase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maskDataUrl,
          correctionText: correctionText.trim(),
          referencePartSlot: referenceSlot,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Something went wrong. Please try again.");
        return;
      }
      onUpdated(image.id, data.url, image.url);
      // Stay open — this is one attempt in a possibly-multi-attempt session.
      // Reset the mask/text for the next attempt; the modal now shows the
      // NEW result (image.url prop updates via the parent's state patch
      // above) so old strokes painted against the previous result are moot.
      setStrokes([]);
      setCorrectionText("");
      setReferenceSlot(null);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevert() {
    if (!image?.previousUrl) return;
    setReverting(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/images/${image.id}/erase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not revert.");
        return;
      }
      onUpdated(image.id, data.url, null);
      // Stay open — reverting is just another attempt in the session, same
      // as a submit (see handleSubmit's comment).
      setStrokes([]);
      setCorrectionText("");
      setReferenceSlot(null);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setReverting(false);
    }
  }

  async function handleFinalize() {
    if (!image) return;
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/images/${image.id}/erase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not finalize.");
        return;
      }
      onFinalized(data.updated ?? []);
      onOpenChange(false);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setFinalizing(false);
    }
  }

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eraser className="h-4.5 w-4.5 text-indigo-500" />
            Fix Region
          </DialogTitle>
          <DialogDescription>
            Paint over the part that&apos;s wrong, then describe the correction or pick a reference photo. Only the
            painted region changes — everything else stays exactly as it is. Removing something? Cover its shadow or
            reflection too, not just the object itself. Keep fixing until it looks right, then use the final image.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted, dynamic per product */}
            <img
              ref={imgRef}
              src={image.url}
              alt="Generated image to fix"
              onLoad={handleImageLoad}
              className="block w-full h-auto select-none"
              draggable={false}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              style={{ opacity: 0.55 }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerLeave={finishStroke}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <label htmlFor="brush-size">Brush size</label>
              <input
                id="brush-size"
                type="range"
                min={8}
                max={200}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-28 accent-indigo-600"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={strokes.length === 0}>
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={strokes.length === 0}>
                <RotateCcw className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>

          <Textarea
            label="What's wrong, and what should it look like instead?"
            placeholder="e.g. the motif on the pallu should be smaller and centered, matching the border pattern"
            value={correctionText}
            onChange={(e) => setCorrectionText(e.target.value)}
            rows={3}
          />

          {partImages.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-gray-700">Reference photo (optional)</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReferenceSlot(null)}
                  className={`h-14 w-14 rounded-lg border-2 text-[10px] font-medium flex items-center justify-center transition-all ${
                    referenceSlot === null
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
                  }`}
                >
                  None
                </button>
                {partImages.map((p) => (
                  <button
                    key={p.slot}
                    type="button"
                    onClick={() => setReferenceSlot(p.slot)}
                    title={p.label}
                    className={`h-14 w-14 rounded-lg border-2 overflow-hidden transition-all ${
                      referenceSlot === p.slot
                        ? "border-indigo-400 ring-2 ring-indigo-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- small Cloudinary thumbnail */}
                    <img src={p.url} alt={p.label} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter className="items-center justify-between sm:justify-between">
          {image.previousUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRevert}
              loading={reverting}
              disabled={submitting || finalizing}
            >
              <History className="h-3.5 w-3.5" /> Undo last edit
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || finalizing}
            >
              {image.previousUrl ? "Close" : "Cancel"}
            </Button>
            {image.previousUrl && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleFinalize}
                loading={finalizing}
                disabled={submitting || reverting}
              >
                <Check className="h-3.5 w-3.5" /> {finalizing ? "Finalizing…" : "Use This Image"}
              </Button>
            )}
            <Button type="button" onClick={handleSubmit} loading={submitting} disabled={reverting || finalizing}>
              {submitting ? "Fixing…" : "Fix Region"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

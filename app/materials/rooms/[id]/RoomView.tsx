"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseJsonSafe } from "@/lib/home-material/client";

type Point = { x: number; y: number };

type Surface = {
  id: string;
  label: string | null;
  geometryData: string | null;
  measurementSource?: string;
};

type Room = {
  id: string;
  imageUrl: string;
  roomType: string;
  surfaces: Surface[];
};

type Swatch = {
  id: string;
  name: string;
  colorName: string | null;
  colorHex: string | null;
  finish: string | null;
  textureAssetUrl?: string | null;
  isCustom?: boolean;
};

type Visualization = {
  id: string;
  status: string;
  outputImageUrl: string | null;
  errorMessage: string | null;
};

function parsePolygon(geometryData: string | null): Point[] | null {
  if (!geometryData) return null;
  try {
    const g = JSON.parse(geometryData);
    if (Array.isArray(g.points) && g.points.every((p: unknown) => typeof (p as Point)?.x === "number" && typeof (p as Point)?.y === "number")) {
      return g.points;
    }
  } catch {
    // ignore malformed rows rather than crash the page
  }
  return null;
}

function polygonPointsAttr(points: Point[]): string {
  return points.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(" ");
}

/** Visual, scrollable swatch picker — a colour/photo card per swatch, not a text dropdown, so people can actually see what they're choosing. */
function SwatchCarousel({
  swatches,
  selectedId,
  onSelect,
}: {
  swatches: Swatch[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  function Card({ sw }: { sw: Swatch }) {
    const selected = sw.id === selectedId;
    return (
      <button
        type="button"
        onClick={() => onSelect(sw.id)}
        className={`shrink-0 w-20 snap-start flex flex-col items-center gap-1 rounded-xl p-1.5 border-2 transition-colors ${
          selected ? "border-indigo-500 bg-indigo-50" : "border-transparent hover:bg-gray-50"
        }`}
      >
        {sw.textureAssetUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sw.textureAssetUrl} alt={sw.name} className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
        ) : (
          <div
            className="w-16 h-16 rounded-lg border border-gray-200"
            style={{ backgroundColor: sw.colorHex || "#e5e7eb" }}
          />
        )}
        <span className="text-[11px] text-gray-700 leading-tight text-center line-clamp-2">{sw.name}</span>
      </button>
    );
  }

  const curated = swatches.filter((sw) => !sw.isCustom);
  const custom = swatches.filter((sw) => sw.isCustom);

  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1">
      {custom.map((sw) => <Card key={sw.id} sw={sw} />)}
      {curated.map((sw) => <Card key={sw.id} sw={sw} />)}
      {swatches.length === 0 && <p className="text-xs text-gray-400 py-4">No swatches yet.</p>}
    </div>
  );
}

/**
 * AI wall detection (fast-lane pivot, 2026-09-07) returns a POLYGON outline
 * — scoped to a straight-on, facing-the-wall photo — shown as an editable
 * draft (draggable vertices) before the user confirms it. Manual
 * click-to-place drawing remains available as a fallback. An already-saved
 * wall can be re-shaped too (2026-09-07, second round) via the same
 * draft/adjust UI, saved with PATCH instead of POST.
 */
export function RoomView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const imageRef = useRef<HTMLDivElement>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reuploading, setReuploading] = useState(false);
  const [reuploadError, setReuploadError] = useState("");

  // Draft polygon being created/adjusted — from AI detection, manual
  // clicks, or re-shaping an already-saved surface (editingSurfaceId set).
  const [draftPoints, setDraftPoints] = useState<Point[] | null>(null);
  const [draftOrigin, setDraftOrigin] = useState<"ai" | "manual" | null>(null);
  const [draftConfidence, setDraftConfidence] = useState<number | null>(null);
  const [editingSurfaceId, setEditingSurfaceId] = useState<string | null>(null);
  const [manualDrawing, setManualDrawing] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState("");

  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [selectedSwatch, setSelectedSwatch] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [visualizations, setVisualizations] = useState<Record<string, Visualization>>({});
  const [previewError, setPreviewError] = useState<Record<string, string>>({});

  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  function loadSwatches() {
    fetch(`/api/home-material/products`)
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => setSwatches(data.products ?? []))
      .catch(() => setSwatches([]));
  }

  useEffect(() => {
    fetch(`/api/home-material/rooms/${roomId}`)
      .then(async (res) => {
        if (res.status === 401) {
          router.push(`/materials/login?returnTo=${encodeURIComponent(`/materials/rooms/${roomId}`)}`);
          return null;
        }
        if (!res.ok) throw new Error("Room not found");
        return res.json();
      })
      .then((data) => data && setRoom(data.room))
      .catch(() => setError("Could not load this room."))
      .finally(() => setLoading(false));

    loadSwatches();
  }, [roomId, router]);

  function resetDraft() {
    setDraftPoints(null);
    setDraftOrigin(null);
    setDraftConfidence(null);
    setEditingSurfaceId(null);
    setManualDrawing(false);
    setLabel("");
  }

  async function handleDetectWall() {
    setDetectError("");
    setDetecting(true);
    resetDraft();
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/detect-wall`, { method: "POST" });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setDetectError(typeof data.error === "string" ? data.error : "Could not detect a wall in this photo. Try selecting it manually below.");
        setManualDrawing(true);
        return;
      }
      setDraftPoints(data.polygon as Point[]);
      setDraftOrigin("ai");
      setDraftConfidence((data.confidence as number) ?? null);
    } catch (err) {
      setDetectError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
      setManualDrawing(true);
    } finally {
      setDetecting(false);
    }
  }

  function startManualDrawing() {
    resetDraft();
    setManualDrawing(true);
    setDraftPoints([]);
  }

  function startEditSurface(s: Surface) {
    const pts = parsePolygon(s.geometryData);
    if (!pts) return;
    setDraftPoints(pts);
    setDraftOrigin("manual");
    setDraftConfidence(null);
    setEditingSurfaceId(s.id);
    setManualDrawing(false);
    setLabel(s.label ?? "");
    setError("");
  }

  function fractionalPoint(e: { clientX: number; clientY: number }): Point {
    const rect = imageRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function handleImageClick(e: React.MouseEvent) {
    if (!manualDrawing) return;
    const p = fractionalPoint(e);
    setDraftPoints((pts) => [...(pts ?? []), p]);
  }

  function finishManualShape() {
    if (!draftPoints || draftPoints.length < 3) {
      setError("Place at least 3 points to trace the wall outline.");
      return;
    }
    setError("");
    setManualDrawing(false);
    setDraftOrigin("manual");
  }

  function handleVertexPointerDown(index: number, e: React.PointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDraggingIndex(index);
  }

  function handleContainerPointerMove(e: React.PointerEvent) {
    if (draggingIndex === null || !draftPoints) return;
    const p = fractionalPoint(e);
    setDraftPoints(draftPoints.map((pt, i) => (i === draggingIndex ? p : pt)));
  }

  function handleContainerPointerUp() {
    setDraggingIndex(null);
  }

  async function handleConfirmSurface() {
    if (!draftPoints || draftPoints.length < 3) return;
    setError("");
    setSaving(true);
    try {
      if (editingSurfaceId) {
        const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces/${editingSurfaceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: draftPoints, label: label || null }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Could not save this shape");
          return;
        }
        setRoom((r) => (r ? { ...r, surfaces: r.surfaces.map((s) => (s.id === editingSurfaceId ? (data.surface as Surface) : s)) } : r));
      } else {
        const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: draftPoints,
            label: label || undefined,
            measurementSource: draftOrigin === "ai" ? "ai_estimated" : "user_confirmed",
            measurementConfidence: draftOrigin === "ai" ? draftConfidence : undefined,
          }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Could not save this wall selection");
          return;
        }
        setRoom((r) => (r ? { ...r, surfaces: [...r.surfaces, data.surface as Surface] } : r));
      }
      resetDraft();
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReupload(file: File) {
    setReuploadError("");
    setReuploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/home-material/rooms/${roomId}`, { method: "PATCH", body: formData });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setReuploadError(typeof data.error === "string" ? data.error : "Reupload failed");
        return;
      }
      setRoom(data.room as Room);
      resetDraft();
      setVisualizations({});
      setSelectedSwatch({});
      setPreviewError({});
    } catch (err) {
      setReuploadError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setReuploading(false);
      if (reuploadInputRef.current) reuploadInputRef.current.value = "";
    }
  }

  async function handleGeneratePreview(surfaceId: string) {
    const productId = selectedSwatch[surfaceId];
    if (!productId) {
      setPreviewError((p) => ({ ...p, [surfaceId]: "Pick a swatch first." }));
      return;
    }
    setPreviewError((p) => ({ ...p, [surfaceId]: "" }));
    setGenerating((g) => ({ ...g, [surfaceId]: true }));
    try {
      const res = await fetch(`/api/home-material/visualizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surfaceId, productId }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setPreviewError((p) => ({ ...p, [surfaceId]: typeof data.error === "string" ? data.error : "Preview failed" }));
        if (data.visualization) setVisualizations((v) => ({ ...v, [surfaceId]: data.visualization as Visualization }));
        return;
      }
      setVisualizations((v) => ({ ...v, [surfaceId]: data.visualization as Visualization }));
    } catch (err) {
      setPreviewError((p) => ({ ...p, [surfaceId]: `Something went wrong: ${err instanceof Error ? err.message : String(err)}` }));
    } finally {
      setGenerating((g) => ({ ...g, [surfaceId]: false }));
    }
  }

  async function handleUploadSwatch() {
    if (!uploadFile) {
      setUploadError("Choose a photo first.");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadName) formData.append("name", uploadName);
      const res = await fetch(`/api/home-material/products/upload`, { method: "POST", body: formData });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setUploadError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      setUploadFile(null);
      setUploadName("");
      loadSwatches();
    } catch (err) {
      setUploadError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto py-16 px-6 text-sm text-gray-500">Loading…</div>;
  if (error && !room) return <div className="max-w-2xl mx-auto py-16 px-6 text-sm text-red-500">{error}</div>;
  if (!room) return null;

  const hasSurfaces = room.surfaces.length > 0;
  const hasDraft = draftPoints !== null;
  const isAdjustingDraft = hasDraft && !manualDrawing;
  const visibleSurfaces = room.surfaces.filter((s) => s.id !== editingSurfaceId);

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/materials/upload" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div>
          <input
            ref={reuploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (hasSurfaces && !window.confirm("Reuploading will clear the walls you've already selected on this photo. Continue?")) {
                if (reuploadInputRef.current) reuploadInputRef.current.value = "";
                return;
              }
              handleReupload(f);
            }}
          />
          <button
            type="button"
            onClick={() => reuploadInputRef.current?.click()}
            disabled={reuploading}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> {reuploading ? "Uploading…" : "Reupload photo"}
          </button>
        </div>
      </div>
      {reuploadError && <p className="text-sm text-red-500">{reuploadError}</p>}

      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {isAdjustingDraft && editingSurfaceId
            ? "Adjust the shape"
            : isAdjustingDraft
            ? "Adjust the outline"
            : manualDrawing
            ? "Trace the wall"
            : hasSurfaces
            ? "Wall detected"
            : "Find the wall"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isAdjustingDraft
            ? "Drag any corner to match the wall precisely, then confirm."
            : manualDrawing
            ? "Click around the wall's edges to trace its outline, then finish."
            : hasSurfaces
            ? "Pick a swatch below to preview it on this wall."
            : "For best results, stand directly facing the wall, straight-on. We'll detect its outline automatically."}
        </p>
      </div>

      <div
        ref={imageRef}
        onClick={handleImageClick}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        className={`relative w-full rounded-2xl overflow-hidden border border-gray-200 select-none touch-none ${manualDrawing ? "cursor-crosshair" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={room.imageUrl} alt="Room" className="w-full h-auto block pointer-events-none" draggable={false} />

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {visibleSurfaces.map((s) => {
            const pts = parsePolygon(s.geometryData);
            if (!pts) return null;
            const isAiDetected = s.measurementSource === "ai_estimated";
            return (
              <polygon
                key={s.id}
                points={polygonPointsAttr(pts)}
                fill={isAiDetected ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.15)"}
                stroke={isAiDetected ? "#6366f1" : "#10b981"}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {draftPoints && draftPoints.length > 0 && (
            <polygon
              points={polygonPointsAttr(draftPoints)}
              fill="rgba(99,102,241,0.15)"
              stroke="#6366f1"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {isAdjustingDraft &&
            draftPoints!.map((p, i) => (
              <circle
                key={i}
                cx={p.x * 100}
                cy={p.y * 100}
                r={1.4}
                fill="#ffffff"
                stroke="#6366f1"
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
                className="cursor-move"
                onPointerDown={(e) => handleVertexPointerDown(i, e)}
              />
            ))}
          {manualDrawing &&
            draftPoints?.map((p, i) => (
              <circle key={i} cx={p.x * 100} cy={p.y * 100} r={1} fill="#6366f1" vectorEffect="non-scaling-stroke" />
            ))}
        </svg>
      </div>

      {!hasSurfaces && !hasDraft && !manualDrawing && (
        <Button className="w-full" size="lg" onClick={handleDetectWall} loading={detecting}>
          Detect wall automatically
        </Button>
      )}
      {detectError && <p className="text-sm text-red-500">{detectError}</p>}

      {!hasDraft && !manualDrawing && (
        <button
          type="button"
          onClick={startManualDrawing}
          className="text-xs text-gray-400 hover:text-gray-600 underline w-full text-center"
        >
          {hasSurfaces ? "Add another wall manually" : "Or trace the wall manually"}
        </button>
      )}

      {manualDrawing && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="flex-1" onClick={resetDraft}>Cancel</Button>
          <Button className="flex-1" onClick={finishManualShape} disabled={(draftPoints?.length ?? 0) < 3}>
            Finish shape ({draftPoints?.length ?? 0} point{draftPoints?.length === 1 ? "" : "s"})
          </Button>
        </div>
      )}

      {isAdjustingDraft && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Label (optional, e.g. accent wall)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="flex-1" onClick={resetDraft}>
              {editingSurfaceId ? "Cancel" : "Discard"}
            </Button>
            <Button className="flex-1" onClick={handleConfirmSurface} loading={saving}>
              {editingSurfaceId ? "Save shape" : "Confirm wall"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {room.surfaces.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-semibold text-gray-900">Preview a material</h2>
          {room.surfaces.map((s) => {
            const vis = visualizations[s.id];
            const isBeingEdited = s.id === editingSurfaceId;
            return (
              <div key={s.id} className={`rounded-2xl border p-4 space-y-3 ${isBeingEdited ? "border-indigo-300 bg-indigo-50/30" : "border-gray-200"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">{s.label || "Wall"}</p>
                  <button
                    type="button"
                    onClick={() => (isBeingEdited ? resetDraft() : startEditSurface(s))}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                  >
                    <Pencil className="h-3 w-3" /> {isBeingEdited ? "Editing…" : "Edit shape"}
                  </button>
                </div>
                <SwatchCarousel
                  swatches={swatches}
                  selectedId={selectedSwatch[s.id]}
                  onSelect={(id) => setSelectedSwatch((sel) => ({ ...sel, [s.id]: id }))}
                />
                <Button className="w-full" onClick={() => handleGeneratePreview(s.id)} loading={generating[s.id]}>
                  Preview
                </Button>
                {previewError[s.id] && <p className="text-sm text-red-500">{previewError[s.id]}</p>}
                {vis?.status === "completed" && vis.outputImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vis.outputImageUrl} alt="Preview" className="w-full rounded-xl border border-gray-200" />
                )}
                {vis?.status === "failed" && (
                  <p className="text-xs text-red-500">{vis.errorMessage || "Preview generation failed."}</p>
                )}
              </div>
            );
          })}

          <div className="rounded-2xl border border-dashed border-gray-300 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Have your own wallpaper or paint photo?</p>
            <p className="text-xs text-gray-500">Upload a photo of it — we&apos;ll match its actual colour and pattern in the preview.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="flex-1 text-sm"
              />
              <input
                type="text"
                placeholder="Name (optional)"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Button onClick={handleUploadSwatch} loading={uploading}>Upload</Button>
            </div>
            {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

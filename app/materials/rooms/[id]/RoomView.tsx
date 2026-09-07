"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
};

type Visualization = {
  id: string;
  status: string;
  outputImageUrl: string | null;
  errorMessage: string | null;
};

type Rect = { x: number; y: number; width: number; height: number };

function parseGeometry(geometryData: string | null): Rect | null {
  if (!geometryData) return null;
  try {
    const g = JSON.parse(geometryData);
    if ([g.x, g.y, g.width, g.height].every((n) => typeof n === "number")) return g;
  } catch {
    // ignore malformed rows rather than crash the page
  }
  return null;
}

/**
 * AI wall detection (fast-lane pivot, 2026-09-07) is the primary path —
 * scoped to a straight-on, facing-the-wall photo. Manual drag-select
 * remains available as a fallback when detection fails or for correction.
 * The rectangle is stored as fractions of the image (0-1) either way, so it
 * stays correct at any display size.
 */
export function RoomView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const imageRef = useRef<HTMLDivElement>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draftRect, setDraftRect] = useState<Rect | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [showManualSelect, setShowManualSelect] = useState(false);

  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState("");

  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [selectedSwatch, setSelectedSwatch] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [visualizations, setVisualizations] = useState<Record<string, Visualization>>({});
  const [previewError, setPreviewError] = useState<Record<string, string>>({});

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

    fetch(`/api/home-material/products`)
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => setSwatches(data.products ?? []))
      .catch(() => setSwatches([]));
  }, [roomId, router]);

  async function handleDetectWall() {
    setDetectError("");
    setDetecting(true);
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/detect-wall`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setDetectError(data.error || "Could not detect a wall in this photo. Try selecting it manually below.");
        setShowManualSelect(true);
        return;
      }
      setRoom((r) => (r ? { ...r, surfaces: [...r.surfaces, data.surface] } : r));
    } catch {
      setDetectError("Something went wrong. Please try again or select the wall manually.");
      setShowManualSelect(true);
    } finally {
      setDetecting(false);
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
      const data = await res.json();
      if (!res.ok) {
        setPreviewError((p) => ({ ...p, [surfaceId]: data.error || "Preview failed" }));
        if (data.visualization) setVisualizations((v) => ({ ...v, [surfaceId]: data.visualization }));
        return;
      }
      setVisualizations((v) => ({ ...v, [surfaceId]: data.visualization }));
    } catch {
      setPreviewError((p) => ({ ...p, [surfaceId]: "Something went wrong. Please try again." }));
    } finally {
      setGenerating((g) => ({ ...g, [surfaceId]: false }));
    }
  }

  function fractionalPoint(e: React.PointerEvent): { x: number; y: number } {
    const rect = imageRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function handlePointerDown(e: React.PointerEvent) {
    const p = fractionalPoint(e);
    setDragStart(p);
    setDraftRect({ x: p.x, y: p.y, width: 0, height: 0 });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStart) return;
    const p = fractionalPoint(e);
    setDraftRect({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      width: Math.abs(p.x - dragStart.x),
      height: Math.abs(p.y - dragStart.y),
    });
  }

  function handlePointerUp() {
    setDragStart(null);
  }

  async function handleSaveSurface() {
    if (!draftRect || draftRect.width < 0.02 || draftRect.height < 0.02) {
      setError("Draw a larger rectangle over the wall first.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draftRect, label: label || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save this wall selection");
        return;
      }
      setRoom((r) => (r ? { ...r, surfaces: [...r.surfaces, data.surface] } : r));
      setDraftRect(null);
      setLabel("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto py-16 px-6 text-sm text-gray-500">Loading…</div>;
  if (error && !room) return <div className="max-w-2xl mx-auto py-16 px-6 text-sm text-red-500">{error}</div>;
  if (!room) return null;

  const hasSurfaces = room.surfaces.length > 0;

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {hasSurfaces ? "Wall detected" : "Find the wall"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {hasSurfaces
            ? "Pick a swatch below to preview it on this wall."
            : "For best results, stand directly facing the wall, straight-on. We'll detect it automatically."}
        </p>
      </div>

      <div
        ref={imageRef}
        onPointerDown={showManualSelect ? handlePointerDown : undefined}
        onPointerMove={showManualSelect ? handlePointerMove : undefined}
        onPointerUp={showManualSelect ? handlePointerUp : undefined}
        className={`relative w-full rounded-2xl overflow-hidden border border-gray-200 select-none touch-none ${showManualSelect ? "cursor-crosshair" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={room.imageUrl} alt="Room" className="w-full h-auto block pointer-events-none" draggable={false} />

        {room.surfaces.map((s) => {
          const g = parseGeometry(s.geometryData);
          if (!g) return null;
          const isAiDetected = s.measurementSource === "ai_estimated";
          return (
            <div
              key={s.id}
              className={`absolute border-2 ${isAiDetected ? "border-indigo-500 bg-indigo-500/15" : "border-emerald-500 bg-emerald-500/15"}`}
              style={{
                left: `${g.x * 100}%`,
                top: `${g.y * 100}%`,
                width: `${g.width * 100}%`,
                height: `${g.height * 100}%`,
              }}
            >
              {s.label && (
                <span className={`absolute -top-6 left-0 text-xs font-medium text-white px-2 py-0.5 rounded ${isAiDetected ? "bg-indigo-500" : "bg-emerald-500"}`}>
                  {s.label}
                </span>
              )}
            </div>
          );
        })}

        {draftRect && (
          <div
            className="absolute border-2 border-indigo-500 bg-indigo-500/15"
            style={{
              left: `${draftRect.x * 100}%`,
              top: `${draftRect.y * 100}%`,
              width: `${draftRect.width * 100}%`,
              height: `${draftRect.height * 100}%`,
            }}
          />
        )}
      </div>

      {!hasSurfaces && (
        <Button className="w-full" size="lg" onClick={handleDetectWall} loading={detecting}>
          Detect wall automatically
        </Button>
      )}
      {detectError && <p className="text-sm text-red-500">{detectError}</p>}

      {!showManualSelect && !hasSurfaces && (
        <button
          type="button"
          onClick={() => setShowManualSelect(true)}
          className="text-xs text-gray-400 hover:text-gray-600 underline w-full text-center"
        >
          Or select the wall manually
        </button>
      )}

      {showManualSelect && (
        <p className="text-xs text-gray-500">Drag on the photo above to select the wall manually.</p>
      )}

      {draftRect && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Label (optional, e.g. accent wall)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button onClick={handleSaveSurface} loading={saving}>Save wall</Button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {room.surfaces.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-semibold text-gray-900">Preview a material</h2>
          {room.surfaces.map((s) => {
            const vis = visualizations[s.id];
            return (
              <div key={s.id} className="rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">{s.label || "Wall"}</p>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSwatch[s.id] || ""}
                    onChange={(e) => setSelectedSwatch((sel) => ({ ...sel, [s.id]: e.target.value }))}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Choose a swatch…</option>
                    {swatches.map((sw) => (
                      <option key={sw.id} value={sw.id}>
                        {sw.name}{sw.colorName ? ` — ${sw.colorName}` : ""}
                      </option>
                    ))}
                  </select>
                  <Button onClick={() => handleGeneratePreview(s.id)} loading={generating[s.id]}>
                    Preview
                  </Button>
                </div>
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
        </div>
      )}
    </div>
  );
}

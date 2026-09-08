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
  materialId?: string | null;
};

type Visualization = {
  id: string;
  status: string;
  outputImageUrl: string | null;
  errorMessage: string | null;
  mode?: string;
  productId?: string | null;
};

type Requirements = {
  wetArea: boolean;
  budgetTier: "budget" | "mid" | "premium" | "any";
  priority: "durability" | "low_maintenance" | "premium_look" | "any";
  preferredCategory: "paint" | "wallpaper" | "wall_texture" | "wall_panel" | "any";
};

type Recommendation = {
  id: string;
  materialId: string | null;
  score: number;
  confidence: number;
  reasons: string[];
  concerns: string[];
  material: { id: string; name: string; category: string } | null;
};

const DEFAULT_REQUIREMENTS: Requirements = {
  wetArea: false,
  budgetTier: "any",
  priority: "any",
  preferredCategory: "any",
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
 * "Request a quote" lead capture (brief §17) — tied to either a specific
 * product or just a material category (recommendations are material-level,
 * not SKU-level, so productId won't always apply). Self-contained: manages
 * its own open/closed + form + submit state rather than living in
 * RoomView's already-large state surface.
 *
 * Resolves server-side to whichever HmRetailer exists — as of 2026-09-08
 * that's exactly one deliberately-labeled placeholder
 * (scripts/seed-retailers.ts), not a real business. The confirmation
 * copy below always echoes the real retailer name/isVerified flag from
 * the response rather than assuming — never silently implies a real
 * business received the request.
 */
function LeadCaptureButton({ productId, materialCategory }: { productId?: string; materialCategory?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ retailerName: string; isVerified: boolean } | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/home-material/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, materialCategory, contactName: name, contactPhone: phone, contactEmail: email || undefined, message: message || undefined }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not submit request");
        return;
      }
      setResult(data.retailer as { retailerName: string; isVerified: boolean });
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <p className="text-xs text-emerald-700 mt-2">
        ✓ Request saved. Note: {result.retailerName} is placeholder demo data, not a real business yet — this won&apos;t
        reach an actual retailer until real partners are onboarded.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 mt-2">
        Request a quote
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-amber-700">⚠ Demo mode — no real retailer will receive this yet.</p>
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <input
        type="tel"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <textarea
        placeholder="Message (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="flex-1" onClick={handleSubmit} loading={submitting}>Submit</Button>
      </div>
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

  const [showHelpMeChoose, setShowHelpMeChoose] = useState<Record<string, boolean>>({});
  const [requirements, setRequirements] = useState<Record<string, Requirements>>({});
  const [recommending, setRecommending] = useState<Record<string, boolean>>({});
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation[]>>({});
  const [recommendError, setRecommendError] = useState<Record<string, string>>({});

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

  function getRequirements(surfaceId: string): Requirements {
    return requirements[surfaceId] ?? DEFAULT_REQUIREMENTS;
  }

  function updateRequirements(surfaceId: string, patch: Partial<Requirements>) {
    setRequirements((r) => ({ ...r, [surfaceId]: { ...getRequirements(surfaceId), ...patch } }));
  }

  async function handleGetRecommendations(surfaceId: string) {
    setRecommendError((p) => ({ ...p, [surfaceId]: "" }));
    setRecommending((g) => ({ ...g, [surfaceId]: true }));
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces/${surfaceId}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getRequirements(surfaceId)),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setRecommendError((p) => ({ ...p, [surfaceId]: typeof data.error === "string" ? data.error : "Could not get recommendations" }));
        return;
      }
      setRecommendations((r) => ({ ...r, [surfaceId]: (data.recommendations as Recommendation[]) ?? [] }));
    } catch (err) {
      setRecommendError((p) => ({ ...p, [surfaceId]: `Something went wrong: ${err instanceof Error ? err.message : String(err)}` }));
    } finally {
      setRecommending((g) => ({ ...g, [surfaceId]: false }));
    }
  }

  /** A demo/custom swatch that's actually of the recommended material, if one exists — lets "Preview" shortcut straight into the existing visualization flow instead of just describing the material. */
  function findSwatchForMaterial(materialId: string | null): Swatch | undefined {
    if (!materialId) return undefined;
    return swatches.find((sw) => sw.materialId === materialId);
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
                  <div className="space-y-1.5">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                        vis.mode === "product_accurate" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {vis.mode === "product_accurate" ? "Product-accurate — from your uploaded photo" : "Quick preview — AI interpretation"}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={vis.outputImageUrl} alt="Preview" className="w-full rounded-xl border border-gray-200" />
                    {vis.productId && <LeadCaptureButton productId={vis.productId} />}
                  </div>
                )}
                {vis?.status === "failed" && (
                  <p className="text-xs text-red-500">{vis.errorMessage || "Preview generation failed."}</p>
                )}

                <div className="border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowHelpMeChoose((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {showHelpMeChoose[s.id] ? "Hide" : "Not sure? Help me choose a material"}
                  </button>

                  {showHelpMeChoose[s.id] && (
                    <div className="mt-3 space-y-3">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={getRequirements(s.id).wetArea}
                          onChange={(e) => updateRequirements(s.id, { wetArea: e.target.checked })}
                        />
                        This wall is in a moisture-prone area (kitchen/bathroom)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={getRequirements(s.id).budgetTier}
                          onChange={(e) => updateRequirements(s.id, { budgetTier: e.target.value as Requirements["budgetTier"] })}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="any">Any budget</option>
                          <option value="budget">Budget</option>
                          <option value="mid">Mid-range</option>
                          <option value="premium">Premium</option>
                        </select>
                        <select
                          value={getRequirements(s.id).priority}
                          onChange={(e) => updateRequirements(s.id, { priority: e.target.value as Requirements["priority"] })}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="any">No strong priority</option>
                          <option value="durability">Durability matters most</option>
                          <option value="low_maintenance">Low maintenance matters most</option>
                          <option value="premium_look">Premium look matters most</option>
                        </select>
                      </div>
                      <select
                        value={getRequirements(s.id).preferredCategory}
                        onChange={(e) => updateRequirements(s.id, { preferredCategory: e.target.value as Requirements["preferredCategory"] })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="any">Any material type</option>
                        <option value="paint">Paint</option>
                        <option value="wallpaper">Wallpaper</option>
                        <option value="wall_texture">Wall Texture</option>
                        <option value="wall_panel">Wall Panels</option>
                      </select>
                      <Button className="w-full" onClick={() => handleGetRecommendations(s.id)} loading={recommending[s.id]}>
                        Get recommendations
                      </Button>
                      {recommendError[s.id] && <p className="text-sm text-red-500">{recommendError[s.id]}</p>}

                      {(recommendations[s.id]?.length ?? 0) > 0 && (
                        <div className="space-y-2">
                          {recommendations[s.id].map((rec, i) => {
                            const swatchMatch = findSwatchForMaterial(rec.materialId);
                            return (
                              <div
                                key={rec.id}
                                className={`rounded-xl border p-3 ${i === 0 ? "border-indigo-300 bg-indigo-50/40" : "border-gray-200"}`}
                              >
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {i === 0 ? "🏆 " : ""}{rec.material?.name ?? "Unknown material"}
                                  </p>
                                  <span className="text-xs text-gray-400">{Math.round(rec.score * 100)}% match</span>
                                </div>
                                {rec.reasons.map((r) => (
                                  <p key={r} className="text-xs text-emerald-700">✓ {r}</p>
                                ))}
                                {rec.concerns.map((c) => (
                                  <p key={c} className="text-xs text-amber-700">⚠ {c}</p>
                                ))}
                                {swatchMatch ? (
                                  <Button
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => {
                                      setSelectedSwatch((sel) => ({ ...sel, [s.id]: swatchMatch.id }));
                                      handleGeneratePreview(s.id);
                                    }}
                                  >
                                    Preview this
                                  </Button>
                                ) : (
                                  <p className="text-xs text-gray-400 mt-2">No demo swatch for this material yet — browse the <Link href="/materials/guide" className="underline">material guide</Link> for details.</p>
                                )}
                                {rec.material?.category && <LeadCaptureButton materialCategory={rec.material.category} />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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

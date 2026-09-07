"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Surface = {
  id: string;
  label: string | null;
  geometryData: string | null;
};

type Room = {
  id: string;
  imageUrl: string;
  roomType: string;
  surfaces: Surface[];
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
 * V1 has no CV wall-detection yet — the user draws the wall region directly
 * by dragging on the photo (locked decision, 2026-09-07). The rectangle is
 * stored as fractions of the image (0-1), so it stays correct at any
 * display size.
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
  }, [roomId, router]);

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

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mark a wall</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drag on the photo to select the wall you want to preview materials on.
        </p>
      </div>

      <div
        ref={imageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-full rounded-2xl overflow-hidden border border-gray-200 select-none touch-none cursor-crosshair"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={room.imageUrl} alt="Room" className="w-full h-auto block pointer-events-none" draggable={false} />

        {room.surfaces.map((s) => {
          const g = parseGeometry(s.geometryData);
          if (!g) return null;
          return (
            <div
              key={s.id}
              className="absolute border-2 border-emerald-500 bg-emerald-500/15"
              style={{
                left: `${g.x * 100}%`,
                top: `${g.y * 100}%`,
                width: `${g.width * 100}%`,
                height: `${g.height * 100}%`,
              }}
            >
              {s.label && (
                <span className="absolute -top-6 left-0 text-xs font-medium bg-emerald-500 text-white px-2 py-0.5 rounded">
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
        <p className="text-xs text-gray-500">
          {room.surfaces.length} wall{room.surfaces.length === 1 ? "" : "s"} saved. Material preview comes next.
        </p>
      )}
    </div>
  );
}

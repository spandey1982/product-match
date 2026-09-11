"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseJsonSafe } from "@/lib/home-material/client";

const ROOM_TYPES = [
  { value: "living_room", label: "Living room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "other", label: "Other" },
];

/**
 * Room-upload modal (2026-09-10) — replaces the old standalone
 * `/materials/upload` page per the user's explicit instruction: no
 * separate page, a pop-up that lands on the room workspace once
 * confirmed. Controlled from the landing page (open/productId are
 * props, not internal state) so both the hero "Upload your room" CTA
 * and every card's "See in my room" action can open the same modal
 * without a page navigation in between.
 *
 * The 401-mid-upload case still can't avoid a real page navigation (the
 * in-memory File object can't survive a redirect to /materials/login
 * and back) — same limitation the old standalone page had. `returnTo`
 * points back at `/materials?openUpload=1[&product=...]` so the landing
 * page reopens this same modal once login completes, rather than
 * silently dropping the user's "upload your room" intent.
 */
export function UploadRoomModal({
  open,
  onOpenChange,
  productId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [roomType, setRoomType] = useState(ROOM_TYPES[0].value);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError("");
    if (f) setPreview(URL.createObjectURL(f));
  }

  async function handleUpload() {
    if (!file) {
      setError("Choose a photo of the room first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("roomType", roomType);

      const res = await fetch("/api/home-material/rooms", { method: "POST", body: formData });

      if (res.status === 401) {
        const returnTo = `/materials?openUpload=1${productId ? `&product=${productId}` : ""}`;
        router.push(`/materials/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      const room = data.room as { id: string } | undefined;
      if (!room?.id) {
        setError("Upload succeeded but the response was unexpected. Please try again.");
        return;
      }
      onOpenChange(false);
      router.push(productId ? `/materials/rooms/${room.id}?product=${productId}` : `/materials/rooms/${room.id}`);
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a room photo</DialogTitle>
          <DialogDescription>We&apos;ll use this to preview materials on your wall.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Room type</label>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROOM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-10 cursor-pointer hover:border-indigo-300 transition-colors">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Selected room" className="max-h-64 rounded-xl object-contain" />
            ) : (
              <>
                <Upload className="h-6 w-6 text-gray-400" />
                <span className="text-sm text-gray-500">Click to choose a photo</span>
              </>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button className="w-full" size="lg" loading={loading} onClick={handleUpload}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

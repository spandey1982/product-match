"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROOM_TYPES = [
  { value: "living_room", label: "Living room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "other", label: "Other" },
];

export function UploadView() {
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
      const data = await res.json();

      if (res.status === 401) {
        router.push(`/materials/login?returnTo=${encodeURIComponent("/materials/upload")}`);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      router.push(`/materials/rooms/${data.room.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto py-16 px-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-100/30 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload a room photo</h1>
          <p className="text-sm text-gray-500 mt-1">
            We&apos;ll use this to preview materials on your wall.
          </p>
        </div>

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
    </div>
  );
}

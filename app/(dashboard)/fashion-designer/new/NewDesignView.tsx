"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Wand2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const GARMENT_TYPES = [
  "Blouse", "Kurti", "Saree", "Lehenga", "Salwar", "Anarkali",
  "Sharara", "Palazzo", "Shirt", "Trouser", "Men Suit", "Dupatta", "Other",
];

const OPTIONAL_ASSET_TYPES = [
  { key: "sketch",        label: "Design Sketch",          hint: "Hand-drawn or digital sketch" },
  { key: "reference",     label: "Reference Garment",      hint: "Photo of a garment you like" },
  { key: "neck",          label: "Neck Design Reference",  hint: "Specific neck style inspiration" },
  { key: "sleeve",        label: "Sleeve Reference",       hint: "Sleeve style inspiration" },
  { key: "back",          label: "Back Design Reference",  hint: "Back style inspiration" },
  { key: "border",        label: "Border / Lace",          hint: "Border or lace fabric" },
  { key: "accessory",     label: "Accessories",            hint: "Buttons, tassels, jhumkas, etc." },
  { key: "color_palette", label: "Color Palette",          hint: "Color swatch or mood board" },
];

interface FileEntry {
  file: File;
  assetType: string;
  preview: string;
}

function DropZone({
  label,
  hint,
  assetType,
  files,
  onAdd,
  onRemove,
  required,
}: {
  label: string;
  hint?: string;
  assetType: string;
  files: FileEntry[];
  onAdd: (files: File[], assetType: string) => void;
  onRemove: (assetType: string, index: number) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      onAdd(Array.from(e.dataTransfer.files), assetType);
    },
    [assetType, onAdd]
  );

  const myFiles = files.filter((f) => f.assetType === assetType);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {required && <span className="text-xs text-red-500 font-semibold">Required</span>}
        {hint && <span className="text-xs text-gray-400">— {hint}</span>}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-5 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-purple-400 bg-purple-50"
            : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/30"
        }`}
      >
        <Upload className="h-5 w-5 mx-auto text-gray-300 mb-1" />
        <p className="text-xs text-gray-400">Drop images or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => onAdd(Array.from(e.target.files ?? []), assetType)}
        />
      </div>

      {myFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {myFiles.map((f, i) => (
            <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.preview} alt={f.file.name} className="h-full w-full object-cover" />
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(assetType, i); }}
                className="absolute top-0.5 right-0.5 h-4 w-4 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X className="h-2.5 w-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewDesignView() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [garmentType, setGarmentType] = useState("Kurti");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showOptional, setShowOptional] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((incoming: File[], assetType: string) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const valid = incoming.filter((f) => allowed.includes(f.type));
    setFiles((prev) => [
      ...prev,
      ...valid.map((f) => ({
        file: f,
        assetType,
        preview: URL.createObjectURL(f),
      })),
    ]);
  }, []);

  const removeFile = useCallback((assetType: string, indexWithinType: number) => {
    setFiles((prev) => {
      const ofType = prev.filter((f) => f.assetType === assetType);
      const toRemove = ofType[indexWithinType];
      return prev.filter((f) => f !== toRemove);
    });
  }, []);

  async function handleSubmit() {
    const fabricFiles = files.filter((f) => f.assetType === "fabric");
    if (fabricFiles.length === 0) {
      setError("Please upload at least one fabric image.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("title", title || `${garmentType} Design`);
      formData.set("garmentType", garmentType);
      for (const { file, assetType } of files) {
        formData.append(assetType, file);
      }

      const res = await fetch("/api/fashion-designer/designs", {
        method: "POST",
        body: formData,
      });
      const data = await res.json() as { designId?: string; error?: string };
      if (!res.ok || !data.designId) throw new Error(data.error ?? "Upload failed");

      // Navigate to design page — it will trigger pipeline processing
      router.push(`/fashion-designer/${data.designId}`);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Wand2 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">New Design</h1>
        </div>
        <p className="text-gray-500">
          Upload fabric images and optional references — the AI will design and generate your garment.
        </p>
      </div>

      {/* Design metadata */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Design Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Maroon Floral Blouse"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Garment Type</label>
          <select
            value={garmentType}
            onChange={(e) => setGarmentType(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
          >
            {GARMENT_TYPES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Required: Fabric Images */}
      <div className="rounded-2xl border-2 border-purple-100 bg-purple-50/30 p-5 space-y-4">
        <DropZone
          label="Fabric Images"
          hint="Multiple angles preferred"
          assetType="fabric"
          files={files}
          onAdd={addFiles}
          onRemove={removeFile}
          required
        />
      </div>

      {/* Optional assets */}
      <div className="space-y-3">
        <button
          onClick={() => setShowOptional((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors"
        >
          {showOptional ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Optional assets ({OPTIONAL_ASSET_TYPES.length} types available)
        </button>

        {showOptional && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-5">
            {OPTIONAL_ASSET_TYPES.map((t) => (
              <DropZone
                key={t.key}
                label={t.label}
                hint={t.hint}
                assetType={t.key}
                files={files}
                onAdd={addFiles}
                onRemove={removeFile}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>
      )}

      <Button
        className="w-full h-12 text-base gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        disabled={submitting || files.filter((f) => f.assetType === "fabric").length === 0}
        onClick={handleSubmit}
        loading={submitting}
      >
        <Wand2 className="h-5 w-5" />
        {submitting ? "Uploading assets..." : "Generate Design"}
      </Button>
    </div>
  );
}

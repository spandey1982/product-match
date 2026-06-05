"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { downloadImage } from "@/lib/share-image";
import {
  Camera,
  Loader2,
  AlertCircle,
  Download,
  Check,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Types ────────────────────────────────────────────────────────────────────

type TryOnState =
  | { kind: "idle" }
  | { kind: "preview"; file: File; previewUrl: string }
  | { kind: "generating" }
  | { kind: "done"; resultUrl: string }
  | { kind: "error"; message: string };

interface Props {
  productId: string;
  /** Called with the Cloudinary URL when a try-on result is successfully generated. */
  onResult: (url: string) => void;
  /** Called when the user resets after a successful generation. */
  onClear: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VirtualTryOn({ productId, onResult, onClear }: Props) {
  const [state, setState] = useState<TryOnState>({ kind: "idle" });
  const [downloaded, setDownloaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File selection ─────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) fileInputRef.current = e.target;
    selectFile(file ?? null);
    // Reset the input value so the same file can be re-selected after a reset
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    selectFile(file);
  }

  function selectFile(file: File | null) {
    if (!file) return;

    // Client-side validation (server re-validates with magic bytes)
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      setState({
        kind: "error",
        message: "Only JPEG, PNG, and WebP photos are accepted.",
      });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setState({ kind: "error", message: "Photo must be under 5 MB." });
      return;
    }

    // Revoke any previous blob URL to avoid memory leaks
    if (state.kind === "preview") URL.revokeObjectURL(state.previewUrl);

    const previewUrl = URL.createObjectURL(file);
    setState({ kind: "preview", file, previewUrl });
  }

  // ── Generation ─────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (state.kind !== "preview") return;
    const { file } = state;

    // Revoke preview blob URL before discarding reference
    URL.revokeObjectURL(state.previewUrl);
    setState({ kind: "generating" });

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch(`/api/products/${productId}/tryon`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json() as { tryOnUrl?: string; error?: string };

      if (!res.ok || !data.tryOnUrl) {
        setState({
          kind: "error",
          message: data.error ?? "Try-on generation failed. Please try again.",
        });
        return;
      }

      setState({ kind: "done", resultUrl: data.tryOnUrl });
      onResult(data.tryOnUrl);
    } catch {
      setState({
        kind: "error",
        message: "A network error occurred. Please check your connection and try again.",
      });
    }
  }

  // ── Download result ────────────────────────────────────────────────────

  async function handleDownload() {
    if (state.kind !== "done") return;
    try {
      await downloadImage(state.resultUrl, "tryon-preview.jpg");
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch {
      // Silent — download is a convenience feature
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  function handleReset() {
    if (state.kind === "preview") URL.revokeObjectURL(state.previewUrl);
    setState({ kind: "idle" });
    onClear();
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-indigo-500" />
            Virtual Try-On
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Upload your photo to see how this looks on you
          </p>
        </div>

        {(state.kind === "preview" ||
          state.kind === "done" ||
          state.kind === "error") && (
          <button
            onClick={handleReset}
            aria-label="Reset try-on"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Idle: upload area ── */}
      {state.kind === "idle" && (
        <label
          htmlFor="tryon-upload"
          className={cn(
            "flex flex-col items-center justify-center gap-3 py-8 px-4",
            "border-2 border-dashed border-gray-200 rounded-2xl",
            "cursor-pointer transition-colors",
            "hover:border-indigo-300 hover:bg-indigo-50/30"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Camera className="h-6 w-6 text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              Upload your photo
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              JPEG, PNG or WebP &middot; Max 5 MB
            </p>
          </div>
          <input
            id="tryon-upload"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
      )}

      {/* ── Preview: photo selected, awaiting confirmation ── */}
      {state.kind === "preview" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
            {/* Thumbnail */}
            <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.previewUrl}
                alt="Your photo preview"
                className="h-full w-full object-cover"
              />
            </div>
            {/* File info */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 truncate">
                {state.file.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {(state.file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            {/* Change photo */}
            <label
              htmlFor="tryon-upload-change"
              className="text-xs text-indigo-600 font-medium hover:text-indigo-800 cursor-pointer shrink-0"
            >
              Change
              <input
                id="tryon-upload-change"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
          </div>

          <button
            onClick={handleGenerate}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-2xl",
              "text-sm font-semibold text-white",
              "bg-gradient-to-r from-indigo-500 to-purple-600",
              "shadow-md shadow-indigo-200/50",
              "hover:opacity-90 active:scale-[0.98] transition-all"
            )}
          >
            <Camera className="h-4 w-4" />
            Generate Try-On
          </button>
        </div>
      )}

      {/* ── Generating: loading state ── */}
      {state.kind === "generating" && (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <div className="relative">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              Generating try-on&hellip;
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              This usually takes 10&ndash;20 seconds
            </p>
          </div>
          {/* Animated progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full animate-[progress_18s_ease-in-out_forwards]" />
          </div>
        </div>
      )}

      {/* ── Done: show result ── */}
      {state.kind === "done" && (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-gray-50 border border-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.resultUrl}
              alt="Virtual try-on result"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-600/80 backdrop-blur-sm text-white">
                Try-on preview
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownload}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 rounded-xl",
                "text-xs font-medium border transition-all active:scale-95",
                downloaded
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              {downloaded ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {downloaded ? "Saved!" : "Download"}
            </button>

            <button
              onClick={handleReset}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 rounded-xl",
                "text-xs font-medium border border-gray-200",
                "bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
                "transition-all active:scale-95"
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try another photo
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {state.kind === "error" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 leading-relaxed">{state.message}</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      {/* ── Privacy notice — shown when user may upload a photo ── */}
      {(state.kind === "idle" || state.kind === "preview") && (
        <div className="flex items-start gap-2 pt-1">
          <ShieldCheck className="h-3.5 w-3.5 text-gray-300 mt-0.5 shrink-0" />
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Your photo is sent to our AI service only to generate this preview
            and is not stored on our servers.
          </p>
        </div>
      )}
    </div>
  );
}

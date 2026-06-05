"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  Upload,
  Check,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Sun,
  Eye,
  UserCheck,
  Glasses,
  Lock,
} from "lucide-react";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const PHOTO_TIPS = [
  { icon: Sun, label: "Good lighting" },
  { icon: UserCheck, label: "Front-facing" },
  { icon: Eye, label: "Face clearly visible" },
  { icon: Glasses, label: "No sunglasses or hat" },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrialRoomPage() {
  const router = useRouter();
  const { photo, photoPreviewUrl, setPhoto, clearPhoto, tryOns, isPhotoLocked } = useTrialRoom();

  const [preview, setPreview] = useState<string | null>(null);
  const [staged, setStaged] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If the context already has a photo, show it as the starting preview
  const displayPreview = preview ?? photoPreviewUrl;
  const isPhotoActive = !!photo;

  // ── File selection ───────────────────────────────────────────────────────

  function selectFile(file: File | null) {
    if (!file) return;
    setError(null);

    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      setError("Only JPEG, PNG, and WebP photos are accepted.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Photo must be under 5 MB.");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setStaged(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    selectFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    selectFile(e.dataTransfer.files?.[0] ?? null);
  }

  // ── Confirm photo ────────────────────────────────────────────────────────

  function handleUsePhoto() {
    if (!staged) return;
    setPhoto(staged);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setStaged(null);
    router.push("/catalog");
  }

  // ── Retake ───────────────────────────────────────────────────────────────

  function handleRetake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setStaged(null);
    setError(null);
    // Also clear context photo if we're retaking an active one
    if (isPhotoActive && !staged) clearPhoto();
  }

  // ── Change existing photo ─────────────────────────────────────────────────

  function handleChange() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setStaged(null);
    setError(null);
    fileInputRef.current?.click();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Camera className="h-6 w-6 text-indigo-500" />
          Virtual Trial Room
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload your photo once and try on any product in your catalog.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5">

        {/* ── Photo area ── */}
        {displayPreview ? (
          /* Preview */
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-gray-100 border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayPreview}
                alt="Your photo"
                className="w-full h-full object-contain"
              />
              {isPhotoActive && !staged && (
                <div className="absolute top-2 left-2">
                  {isPhotoLocked ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-600/80 backdrop-blur-sm text-white">
                      <Lock className="h-2.5 w-2.5" />
                      Session active
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-600/80 text-white backdrop-blur-sm">
                      Active photo
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Photo tips shown as all-green once a photo is selected */}
            <div className="grid grid-cols-2 gap-1.5">
              {PHOTO_TIPS.map(({ label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 p-2 bg-emerald-50 rounded-xl"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs text-emerald-700">{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Upload zone */
          <label
            htmlFor="trial-room-upload"
            className={cn(
              "flex flex-col items-center justify-center gap-4 py-10 px-4",
              "border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer",
              "hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Upload className="h-7 w-7 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                Upload your photo
              </p>
              <p className="text-xs text-gray-400 mt-1">
                JPEG, PNG or WebP &middot; Max 5 MB
              </p>
            </div>

            {/* Tips shown before upload */}
            <div className="w-full grid grid-cols-2 gap-1.5">
              {PHOTO_TIPS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl"
                >
                  <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
              ))}
            </div>

            <input
              id="trial-room-upload"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="space-y-2">
          {/* Use This Photo — shown when a new photo is staged */}
          {staged && (
            <button
              onClick={handleUsePhoto}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-2xl",
                "text-sm font-semibold text-white",
                "bg-gradient-to-r from-indigo-500 to-purple-600",
                "shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
              )}
            >
              <Check className="h-4 w-4" />
              Use This Photo
            </button>
          )}

          {/* Already active: go to catalog */}
          {isPhotoActive && !staged && (
            <Link href="/catalog">
              <button
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-2xl",
                  "text-sm font-semibold text-white",
                  "bg-gradient-to-r from-indigo-500 to-purple-600",
                  "shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.98] transition-all"
                )}
              >
                Browse Catalog
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          )}

          {/* Retake / Change — hidden once session is active to prevent
               inconsistencies with already-generated try-ons */}
          {displayPreview && !isPhotoLocked && (
            <button
              onClick={isPhotoActive && !staged ? handleChange : handleRetake}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isPhotoActive && !staged ? "Change Photo" : "Retake Photo"}

              {/* Hidden input for change flow */}
              {isPhotoActive && !staged && (
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              )}
            </button>
          )}

          {/* Locked notice */}
          {isPhotoLocked && isPhotoActive && !staged && (
            <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" />
              Photo locked — try-ons in progress. Use &ldquo;Next Customer&rdquo; to reset.
            </p>
          )}
        </div>

        {/* Try-ons summary — shown when try-ons already exist */}
        {tryOns.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <Link
              href="/my-try-ons"
              className="flex items-center justify-between py-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <span className="font-medium">View My Try-Ons</span>
              <span className="flex items-center gap-1">
                {tryOns.length} item{tryOns.length !== 1 ? "s" : ""}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        )}
      </div>

      {/* Privacy */}
      <div className="mt-4 flex items-start gap-2 px-1">
        <ShieldCheck className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Your photo is used only to generate try-on previews during this
          session. It is never stored on our servers.
        </p>
      </div>
    </div>
  );
}

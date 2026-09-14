"use client";

import { useRef, useState } from "react";
import {
  Sparkles,
  Camera,
  Upload,
  UserCircle2,
  Trash2,
  RotateCcw,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { TrialRoomSetupContent } from "@/components/trial-room/TrialRoomSetupContent";
import { CameraCapture } from "@/components/trial-room/CameraCapture";
import { TryOnViewer } from "@/components/trial-room/TryOnViewer";
import { TryOnStyleControl } from "@/components/trial-room/TryOnStyleControl";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";
import { displayUrl } from "@/lib/images/variants";
import { cn } from "@/lib/utils";
import { generateClientId, type TryOnEntry } from "@/lib/trial-room-types";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// ─── Garment card ─────────────────────────────────────────────────────────────

function GarmentCard({ entry, onOpen }: { entry: TryOnEntry; onOpen?: () => void }) {
  const { retryTryOn, removeFromTryOns } = useTrialRoom();

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm group">
      {entry.status === "done" && entry.resultUrl ? (
        <div className="relative aspect-[3/4] bg-gray-50">
          <button
            onClick={onOpen}
            className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
            aria-label={`View full-screen try-on for ${entry.product.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl(entry.resultUrl)}
              alt={entry.product.title}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              draggable={false}
            />
          </button>
        </div>
      ) : entry.status === "generating" ? (
        <div className="aspect-[3/4] bg-gray-50 flex flex-col items-center justify-center gap-3 p-4">
          <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
          <p className="text-xs font-medium text-gray-600">Generating…</p>
        </div>
      ) : (
        <div className="aspect-[3/4] bg-gray-50 flex flex-col items-center justify-center gap-3 p-4">
          <AlertCircle className="h-8 w-8 text-red-300" />
          <p className="text-xs text-center text-gray-500 leading-relaxed">
            {entry.errorMessage ?? "Generation failed"}
          </p>
          <button
            onClick={() => retryTryOn(entry.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      <div className="p-2.5 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-800 truncate">{entry.product.title}</p>
        <button
          onClick={() => removeFromTryOns(entry.id)}
          aria-label="Remove"
          className="h-6 w-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Pending garment (captured, not yet tried on) ──────────────────────────────

interface PendingGarment {
  id: string;
  file: File;
  previewUrl: string;
}

function PendingGarmentCard({
  garment,
  onTryOn,
  onDiscard,
  disabled,
}: {
  garment: PendingGarment;
  onTryOn: () => void;
  onDiscard: () => void;
  disabled: boolean;
}) {
  return (
    <div className="relative bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm aspect-[3/4] group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={garment.previewUrl}
        alt="Captured garment"
        className="w-full h-full object-cover"
        draggable={false}
      />
      <button
        onClick={onDiscard}
        aria-label="Discard captured garment"
        className="absolute top-2 left-2 h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm shadow flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-white transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onTryOn}
        disabled={disabled}
        title={disabled ? "Try-on limit reached" : "Try this on"}
        aria-label="Try this garment on"
        className={cn(
          "absolute top-2 right-2 h-9 w-9 rounded-full flex items-center justify-center transition-all",
          disabled
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-300/50 hover:opacity-90"
        )}
      >
        <HangerPlusIcon size={16} />
      </button>
      <span className="absolute bottom-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white">
        Tap to try on
      </span>
    </div>
  );
}

// ─── Page view ────────────────────────────────────────────────────────────────

interface ViewerState {
  entries: TryOnEntry[];
  index: number;
}

/**
 * Camera-first trial room layout — used instead of TrialRoomView.tsx when a
 * client's ClientProfile.trialRoomLayout is "quick-capture" (see
 * app/(dashboard)/trial-room/page.tsx). No catalog dependency: the customer
 * profile, garment capture, try-on, and review all happen on this one screen.
 */
export function QuickCaptureTrialRoomView() {
  const { photo, photoPreviewUrl, tryOns, clearAll, addCapturedGarment, isAtLimit, tryOnLimit } =
    useTrialRoom();

  const [showCamera, setShowCamera] = useState(false);
  const [pending, setPending] = useState<PendingGarment[]>([]);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const doneEntries = tryOns.filter(
    (t): t is TryOnEntry & { resultUrl: string } => t.status === "done" && !!t.resultUrl
  );

  function openViewer(entry: TryOnEntry) {
    const idx = doneEntries.findIndex((e) => e.id === entry.id);
    if (idx === -1) return;
    setViewer({ entries: [...doneEntries], index: idx });
  }

  function handleCaptured(file: File) {
    setPending((prev) => [...prev, { id: generateClientId(), file, previewUrl: URL.createObjectURL(file) }]);
    setShowCamera(false);
  }

  // Upload-from-device path — always available alongside the camera, not just
  // a fallback for when camera permission is denied (browser camera prompts
  // are unreliable enough in practice that retailers want both up front).
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) return;
    if (file.size > MAX_SIZE_BYTES) return;
    handleCaptured(file);
  }

  function handleTryOn(garment: PendingGarment) {
    addCapturedGarment(garment.file);
    setPending((prev) => prev.filter((g) => g.id !== garment.id));
    URL.revokeObjectURL(garment.previewUrl);
  }

  function handleDiscard(garment: PendingGarment) {
    setPending((prev) => prev.filter((g) => g.id !== garment.id));
    URL.revokeObjectURL(garment.previewUrl);
  }

  function handleClearProfile() {
    if (!confirm("Clear this customer's profile and all try-ons for this session?")) return;
    pending.forEach((g) => URL.revokeObjectURL(g.previewUrl));
    setPending([]);
    clearAll();
  }

  // ── No photo yet — set up the customer profile first ─────────────────────
  if (!photo) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-500" />
              Virtual Trial Room
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Set up the customer&apos;s photo, then capture garments with the camera to try them on.
            </p>
          </div>
          <TryOnStyleControl />
        </div>
        <TrialRoomSetupContent completeLabel="Start Capturing" hideHeader />
      </div>
    );
  }

  return (
    <>
      {showCamera && (
        <CameraCapture onCapture={handleCaptured} onClose={() => setShowCamera(false)} />
      )}

      {viewer && viewer.entries.length > 0 && (
        <TryOnViewer
          entries={viewer.entries}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-500" />
              Virtual Trial Room
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {tryOns.length > 0
                ? `${tryOns.length} garment${tryOns.length !== 1 ? "s" : ""} tried on this session`
                : "Capture a garment to try it on"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TryOnStyleControl />
            <button
              onClick={handleClearProfile}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Profile
            </button>
          </div>
        </div>

        {/* Customer profile strip */}
        <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3 mb-5 shadow-sm">
          {photoPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreviewUrl}
              alt="Customer"
              className="h-12 w-12 rounded-full object-cover border border-gray-100"
            />
          ) : (
            <UserCircle2 className="h-12 w-12 text-gray-300" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">Customer profile</p>
            <p className="text-xs text-gray-400">
              {isAtLimit ? `Try-on limit reached (${tryOnLimit})` : "Session active"}
            </p>
          </div>
        </div>

        {/* Capture / upload buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setShowCamera(true)}
            disabled={isAtLimit}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all",
              isAtLimit
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200/50 hover:opacity-90 active:scale-[0.99]"
            )}
          >
            <Camera className="h-4.5 w-4.5" />
            Capture Garment
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAtLimit}
            title="Upload a garment photo from this device instead"
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold border transition-all",
              isAtLimit
                ? "border-gray-100 bg-gray-100 text-gray-400 cursor-not-allowed"
                : "border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-[0.99]"
            )}
          >
            <Upload className="h-4.5 w-4.5" />
            Upload Garment
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>

        {/* Pending (captured, not yet tried on) */}
        {pending.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Captured — tap the hanger to try on
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pending.map((garment) => (
                <PendingGarmentCard
                  key={garment.id}
                  garment={garment}
                  onTryOn={() => handleTryOn(garment)}
                  onDiscard={() => handleDiscard(garment)}
                  disabled={isAtLimit}
                />
              ))}
            </div>
          </div>
        )}

        {/* Reviewed together */}
        {tryOns.length === 0 && pending.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-sm">
            <HangerPlusIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 mb-1">No garments yet</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              Tap &ldquo;Capture Garment&rdquo; above to photograph a piece and try it on.
            </p>
          </div>
        ) : tryOns.length > 0 ? (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              This session
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {tryOns.map((entry) => (
                <GarmentCard
                  key={entry.id}
                  entry={entry}
                  onOpen={entry.status === "done" ? () => openViewer(entry) : undefined}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

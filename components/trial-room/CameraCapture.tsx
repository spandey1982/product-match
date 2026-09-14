"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertCircle, Upload } from "lucide-react";

interface Props {
  /** Called with the captured (or picked) garment photo. Does not close the modal — caller decides. */
  onCapture: (file: File) => void;
  onClose: () => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Live camera capture for the quick-capture trial room layout — opens the
 * device camera via getUserMedia, lets the retailer frame the garment, and
 * snapshots a frame to a File. Falls back to a plain file picker (which still
 * offers the device camera app on mobile) when getUserMedia is unavailable
 * or permission is denied, so a locked-down browser can never dead-end the flow.
 */
export function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not available on this device or browser.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        throw new Error("Camera access was denied or is unavailable.");
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setReady(true);
    }

    start().catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `garment-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) return;
    if (file.size > MAX_SIZE_BYTES) return;
    onCapture(file);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-medium text-white/90">Capture garment</span>
        <button
          onClick={onClose}
          aria-label="Close camera"
          className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center px-4">
        {error ? (
          <div className="text-center max-w-xs">
            <AlertCircle className="h-10 w-10 text-white/40 mx-auto mb-3" />
            <p className="text-sm text-white/80 mb-4">{error}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-medium hover:bg-white/90 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Choose photo instead
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-full max-w-full rounded-2xl"
          />
        )}
      </div>

      {/* Bottom bar */}
      {!error && (
        <div className="flex items-center justify-center gap-8 p-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Choose from device"
            aria-label="Choose photo from device instead"
            className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <Upload className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={handleCapture}
            disabled={!ready}
            aria-label="Capture photo"
            className="h-16 w-16 rounded-full bg-white border-4 border-white/30 disabled:opacity-40 active:scale-95 transition-transform"
          />
          {/* Spacer — keeps the capture button centered against the upload button on the left */}
          <div className="h-11 w-11" aria-hidden="true" />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
      />

      {!error && !ready && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Camera className="h-8 w-8 text-white/30 animate-pulse" />
        </div>
      )}
    </div>
  );
}

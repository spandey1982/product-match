"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Download,
  Check,
} from "lucide-react";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import { downloadImage } from "@/lib/share-image";
import { cn } from "@/lib/utils";
import type { TryOnEntry } from "@/lib/trial-room-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 50; // px — minimum drag to commit navigation
const EDGE_RESISTANCE = 0.18; // rubber-band factor at first/last slide

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Snapshot of completed try-on entries at the time the viewer was opened. */
  entries: TryOnEntry[];
  initialIndex: number;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TryOnViewer({ entries, initialIndex, onClose }: Props) {
  const { addToWishlist, isInWishlist } = useTrialRoom();

  // ── React state (re-renders UI chrome — dots, counter, action buttons) ──
  const [index, setIndex] = useState(initialIndex);
  const [downloaded, setDownloaded] = useState(false);

  const total = entries.length;
  const current = entries[index];
  const wishlisted = isInWishlist(current.id);

  // ── Refs for zero-jank drag (bypass React for transform updates) ─────────
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(initialIndex);         // always-current index for handlers
  const dxRef = useRef(0);                       // current drag delta

  // Touch refs
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalRef = useRef<boolean | null>(null);

  // Mouse refs
  const isDraggingMouseRef = useRef(false);
  const mouseStartXRef = useRef<number | null>(null);

  // ── Core helpers ──────────────────────────────────────────────────────────

  function updateTransform(idx: number, dx: number, animated: boolean) {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animated
      ? "transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)"
      : "none";
    el.style.transform = `translateX(calc(${-idx * 100}vw + ${dx}px))`;
  }

  function resistedDx(dx: number, idx: number): number {
    const atStart = idx === 0 && dx > 0;
    const atEnd = idx === total - 1 && dx < 0;
    return atStart || atEnd ? dx * EDGE_RESISTANCE : dx;
  }

  function navigate(newIndex: number) {
    indexRef.current = newIndex;
    setIndex(newIndex);
    setDownloaded(false);
    updateTransform(newIndex, 0, true);
  }

  // ── Set initial transform synchronously before first paint ───────────────
  useLayoutEffect(() => {
    updateTransform(initialIndex, 0, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lock body scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft") {
        const next = Math.max(0, indexRef.current - 1);
        if (next !== indexRef.current) navigate(next);
      }
      if (e.key === "ArrowRight") {
        const next = Math.min(total - 1, indexRef.current + 1);
        if (next !== indexRef.current) navigate(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, onClose]);

  // ── Native touchmove — passive: false so we can preventDefault ───────────
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    function onTouchMove(e: TouchEvent) {
      if (touchStartXRef.current === null || touchStartYRef.current === null) return;

      const dx = e.touches[0].clientX - touchStartXRef.current;
      const dy = e.touches[0].clientY - touchStartYRef.current;

      // Determine axis on first significant movement
      if (
        isHorizontalRef.current === null &&
        (Math.abs(dx) > 5 || Math.abs(dy) > 5)
      ) {
        isHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
      }

      if (isHorizontalRef.current) {
        e.preventDefault();
        const applied = resistedDx(dx, indexRef.current);
        dxRef.current = applied;
        updateTransform(indexRef.current, applied, false);
      }
    }

    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // ── Global mouse move / up (desktop drag — works even if cursor leaves track) ──
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingMouseRef.current || mouseStartXRef.current === null) return;
      const dx = e.clientX - mouseStartXRef.current;
      const applied = resistedDx(dx, indexRef.current);
      dxRef.current = applied;
      updateTransform(indexRef.current, applied, false);
    }

    function onMouseUp() {
      if (!isDraggingMouseRef.current) return;
      isDraggingMouseRef.current = false;
      const finalDx = dxRef.current;
      dxRef.current = 0;
      mouseStartXRef.current = null;

      if (Math.abs(finalDx) > SWIPE_THRESHOLD) {
        const target =
          finalDx > 0
            ? Math.max(0, indexRef.current - 1)
            : Math.min(total - 1, indexRef.current + 1);
        navigate(target);
      } else {
        updateTransform(indexRef.current, 0, true);
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // ── Touch event handlers (synthetic — start / end only) ──────────────────

  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    dxRef.current = 0;
  }

  function handleTouchEnd() {
    const finalDx = dxRef.current;
    dxRef.current = 0;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalRef.current = null;

    if (Math.abs(finalDx) > SWIPE_THRESHOLD) {
      const target =
        finalDx > 0
          ? Math.max(0, indexRef.current - 1)
          : Math.min(total - 1, indexRef.current + 1);
      navigate(target);
    } else {
      updateTransform(indexRef.current, 0, true);
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Only left-button drag
    if (e.button !== 0) return;
    isDraggingMouseRef.current = true;
    mouseStartXRef.current = e.clientX;
    dxRef.current = 0;
  }

  // ── Download ──────────────────────────────────────────────────────────────

  async function handleDownload() {
    if (!current.resultUrl) return;
    try {
      const filename = `tryon-${current.product.title
        .replace(/\s+/g, "-")
        .toLowerCase()}.jpg`;
      await downloadImage(current.resultUrl, filename);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch {
      // Silent — download is a convenience feature
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Try-on viewer"
    >

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0 bg-gradient-to-b from-black/60 to-transparent absolute top-0 inset-x-0 z-10 pointer-events-none">
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 flex items-center justify-center text-white transition-colors pointer-events-auto"
          aria-label="Close viewer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0 pointer-events-none">
          <p className="text-white text-sm font-semibold truncate leading-tight drop-shadow">
            {current.product.title}
          </p>
          <p className="text-white/60 text-xs mt-0.5 capitalize leading-tight">
            {current.product.category}
          </p>
        </div>

        <div className="h-7 px-2.5 rounded-full bg-black/40 backdrop-blur-sm flex items-center text-white/80 text-xs font-medium shrink-0 pointer-events-none">
          {index + 1}&thinsp;/&thinsp;{total}
        </div>
      </div>

      {/* ── Image track ── */}
      <div
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {/* All images in a single horizontal strip */}
        <div
          ref={trackRef}
          className="flex h-full"
          style={{
            width: `${total * 100}vw`,
            // Initial value — overwritten synchronously by useLayoutEffect
            transform: `translateX(${-initialIndex * 100}vw)`,
            willChange: "transform",
          }}
        >
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-center p-6"
              style={{ width: "100vw", height: "100%" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.resultUrl!}
                alt={`Try-on for ${entry.product.title}`}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* ── Desktop prev / next chevrons ── */}
        {index > 0 && (
          <button
            onClick={() => navigate(Math.max(0, index - 1))}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 items-center justify-center text-white transition-colors z-10"
            aria-label="Previous try-on"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {index < total - 1 && (
          <button
            onClick={() => navigate(Math.min(total - 1, index + 1))}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 items-center justify-center text-white transition-colors z-10"
            aria-label="Next try-on"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div className="shrink-0 pb-safe-bottom pb-6 pt-4 px-4 flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 to-transparent">

        {/* Dot indicators */}
        {total > 1 && (
          <div className="flex items-center gap-1.5">
            {entries.map((_, i) => (
              <button
                key={i}
                onClick={() => navigate(i)}
                className={cn(
                  "rounded-full transition-all duration-200",
                  i === index
                    ? "w-5 h-1.5 bg-white"
                    : "w-1.5 h-1.5 bg-white/35 hover:bg-white/60"
                )}
                aria-label={`Go to try-on ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => addToWishlist(current.id)}
            disabled={wishlisted}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95",
              wishlisted
                ? "bg-rose-500 text-white"
                : "bg-white/15 backdrop-blur-sm text-white hover:bg-white/25"
            )}
          >
            <Heart
              className={cn("h-4 w-4", wishlisted && "fill-white")}
            />
            {wishlisted ? "Saved" : "Save"}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-all active:scale-95"
          >
            {downloaded ? (
              <Check className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloaded ? "Saved!" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}

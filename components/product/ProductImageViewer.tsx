"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 50;
const EDGE_RESISTANCE = 0.18;
const TAP_MOVE_MAX = 8; // movement under this on release = a tap (zoom toggle)
const DEFAULT_MAX_ZOOM = 3;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Ordered list of image URLs to display. */
  images: string[];
  /** Optional per-slide label (e.g. "Product", "On model"). */
  labels?: string[];
  /**
   * Optional per-slide max zoom (e.g. 3 for full shots, 2 for close-up crops).
   * Defaults to 3. A value of 1 disables zoom for that slide.
   */
  maxZooms?: number[];
  /** Which slide to open on. */
  initialIndex: number;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductImageViewer({ images, labels, maxZooms, initialIndex, onClose }: Props) {
  const total = images.length;

  const [index, setIndex] = useState(initialIndex);
  // Zoom/pan of the CURRENT slide (React state — not perf-critical like swipe).
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Refs for zero-jank drag — bypass React for transform updates
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(initialIndex);
  const dxRef = useRef(0);

  // Touch
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalRef = useRef<boolean | null>(null);

  // Mouse
  const isDraggingMouseRef = useRef(false);
  const mouseStartXRef = useRef<number | null>(null);
  const mouseStartYRef = useRef<number | null>(null);

  // Zoom/pan
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(0);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function maxZoomFor(idx: number): number {
    return maxZooms?.[idx] ?? DEFAULT_MAX_ZOOM;
  }

  function applyZoom(nextScale: number, idx: number) {
    const clamped = Math.min(maxZoomFor(idx), Math.max(1, nextScale));
    scaleRef.current = clamped;
    setScale(clamped);
    if (clamped === 1) {
      panRef.current = { x: 0, y: 0 };
      setPan({ x: 0, y: 0 });
    }
  }

  function toggleZoom(idx: number) {
    applyZoom(scaleRef.current > 1 ? 1 : maxZoomFor(idx), idx);
  }

  function resetZoom() {
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setScale(1);
    setPan({ x: 0, y: 0 });
  }

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
    resetZoom();
    updateTransform(newIndex, 0, true);
  }

  // ── Initial transform (before first paint) ────────────────────────────────

  useLayoutEffect(() => {
    updateTransform(initialIndex, 0, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Body scroll lock ──────────────────────────────────────────────────────

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "0") { applyZoom(1, indexRef.current); return; }
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

  // ── Wheel zoom (desktop) ──────────────────────────────────────────────────

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (maxZoomFor(indexRef.current) <= 1) return;
      e.preventDefault();
      applyZoom(scaleRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15), indexRef.current);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // ── Native touchmove (passive: false to allow preventDefault) ────────────

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    function onTouchMove(e: TouchEvent) {
      if (touchStartXRef.current === null || touchStartYRef.current === null) return;
      const dx = e.touches[0].clientX - touchStartXRef.current;
      const dy = e.touches[0].clientY - touchStartYRef.current;

      // Zoomed in → pan the image instead of swiping slides.
      if (scaleRef.current > 1) {
        e.preventDefault();
        movedRef.current = Math.max(movedRef.current, Math.hypot(dx, dy));
        const np = { x: panStartRef.current.x + dx, y: panStartRef.current.y + dy };
        panRef.current = np;
        setPan(np);
        return;
      }

      if (isHorizontalRef.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        isHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
      }
      if (isHorizontalRef.current) {
        e.preventDefault();
        const applied = resistedDx(dx, indexRef.current);
        dxRef.current = applied;
        movedRef.current = Math.abs(applied);
        updateTransform(indexRef.current, applied, false);
      }
    }
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // ── Global mouse move / up ────────────────────────────────────────────────

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (panningRef.current && mouseStartXRef.current !== null && mouseStartYRef.current !== null) {
        const dx = e.clientX - mouseStartXRef.current;
        const dy = e.clientY - mouseStartYRef.current;
        movedRef.current = Math.max(movedRef.current, Math.hypot(dx, dy));
        const np = { x: panStartRef.current.x + dx, y: panStartRef.current.y + dy };
        panRef.current = np;
        setPan(np);
        return;
      }
      if (!isDraggingMouseRef.current || mouseStartXRef.current === null) return;
      const dx = e.clientX - mouseStartXRef.current;
      const applied = resistedDx(dx, indexRef.current);
      dxRef.current = applied;
      movedRef.current = Math.max(movedRef.current, Math.abs(applied));
      updateTransform(indexRef.current, applied, false);
    }
    function onMouseUp() {
      if (panningRef.current) {
        panningRef.current = false;
        if (movedRef.current < TAP_MOVE_MAX) toggleZoom(indexRef.current);
        mouseStartXRef.current = null;
        mouseStartYRef.current = null;
        return;
      }
      if (!isDraggingMouseRef.current) return;
      isDraggingMouseRef.current = false;
      const finalDx = dxRef.current;
      const moved = movedRef.current;
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
        if (moved < TAP_MOVE_MAX) toggleZoom(indexRef.current); // tap = zoom toggle
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

  // ── Touch synthetic handlers ──────────────────────────────────────────────

  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    dxRef.current = 0;
    movedRef.current = 0;
    panStartRef.current = { ...panRef.current };
  }

  function handleTouchEnd() {
    const finalDx = dxRef.current;
    const moved = movedRef.current;
    dxRef.current = 0;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalRef.current = null;

    if (scaleRef.current > 1) {
      if (moved < TAP_MOVE_MAX) toggleZoom(indexRef.current);
      return;
    }
    if (Math.abs(finalDx) > SWIPE_THRESHOLD) {
      const target =
        finalDx > 0
          ? Math.max(0, indexRef.current - 1)
          : Math.min(total - 1, indexRef.current + 1);
      navigate(target);
    } else {
      updateTransform(indexRef.current, 0, true);
      if (moved < TAP_MOVE_MAX) toggleZoom(indexRef.current);
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    mouseStartXRef.current = e.clientX;
    mouseStartYRef.current = e.clientY;
    movedRef.current = 0;
    if (scaleRef.current > 1) {
      panningRef.current = true;
      panStartRef.current = { ...panRef.current };
    } else {
      isDraggingMouseRef.current = true;
      dxRef.current = 0;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const zoomed = scale > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Product image viewer"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0 bg-gradient-to-b from-black/60 to-transparent absolute top-0 inset-x-0 z-10 pointer-events-none">
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 flex items-center justify-center text-white transition-colors pointer-events-auto"
          aria-label="Close viewer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0 pointer-events-none">
          <p className="text-white/80 text-xs font-medium capitalize leading-tight drop-shadow">
            {labels?.[index] ?? (index === 0 ? "Product" : "On model")}
          </p>
        </div>

        {total > 1 && (
          <div className="h-7 px-2.5 rounded-full bg-black/40 backdrop-blur-sm flex items-center text-white/80 text-xs font-medium shrink-0 pointer-events-none">
            {index + 1}&thinsp;/&thinsp;{total}
          </div>
        )}
      </div>

      {/* Image track */}
      <div
        className={cn(
          "flex-1 overflow-hidden relative",
          zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div
          ref={trackRef}
          className="flex h-full"
          style={{
            width: `${total * 100}vw`,
            transform: `translateX(${-initialIndex * 100}vw)`,
            willChange: "transform",
          }}
        >
          {images.map((src, i) => {
            const isActive = i === index;
            return (
              <div
                key={i}
                className="flex items-center justify-center p-6"
                style={{ width: "100vw", height: "100%" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={labels?.[i] ?? `Image ${i + 1}`}
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                  draggable={false}
                  style={
                    isActive && zoomed
                      ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transition: "transform 0.12s ease-out" }
                      : { transition: "transform 0.12s ease-out" }
                  }
                />
              </div>
            );
          })}
        </div>

        {/* Desktop prev/next chevrons — hidden while zoomed */}
        {!zoomed && index > 0 && (
          <button
            onClick={() => navigate(Math.max(0, index - 1))}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 items-center justify-center text-white transition-colors z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {!zoomed && index < total - 1 && (
          <button
            onClick={() => navigate(Math.min(total - 1, index + 1))}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 items-center justify-center text-white transition-colors z-10"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Bottom bar — dot indicators */}
      {total > 1 && (
        <div className="shrink-0 pb-safe-bottom pb-6 pt-3 px-4 flex justify-center bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => navigate(i)}
                className={cn(
                  "rounded-full transition-all duration-200",
                  i === index
                    ? "w-5 h-1.5 bg-white"
                    : "w-1.5 h-1.5 bg-white/35 hover:bg-white/60"
                )}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

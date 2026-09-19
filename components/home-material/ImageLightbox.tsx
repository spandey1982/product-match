"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

interface ImageLightboxProps {
  /** null closes the lightbox — the caller owns the "which image, if any" state. */
  src: string | null;
  alt: string;
  onClose: () => void;
}

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/**
 * Fullscreen, zoomable viewer for a generated room trial image — wheel/
 * pinch to zoom, drag to pan once zoomed, double-click/double-tap to
 * toggle. Built on the same Dialog primitive as UploadRoomModal (portals
 * to document.documentElement via app/materials/HmThemeRoot.tsx's fix, so
 * it inherits the .hm-theme scoping without repeating that earlier bug).
 * Deliberately reimplements zoom/pan here rather than pulling in a new
 * dependency — this is plain pointer-event arithmetic, not a case that
 * needs a library (CLAUDE.md §15).
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  // Tracks whether a pointer is currently down — read during render (to
  // suppress the CSS transition while actively dragging/pinching), so it
  // must be state, not a ref (refs can't be read during render).
  const [isInteracting, setIsInteracting] = useState(false);
  const panState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef(1);

  function reset() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setIsInteracting(false);
    panState.current = null;
    pointers.current.clear();
    pinchStartDist.current = null;
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset();
      onClose();
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((s) => {
      const next = clampScale(s - e.deltaY * 0.0025);
      if (next === 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  }

  function handleDoubleClick() {
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(DOUBLE_TAP_SCALE);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Best-effort: capture keeps this pointer's move events coming even if
    // it drifts outside the element's bounds mid-gesture. Not guaranteed to
    // succeed (the browser can reject a pointerId it doesn't recognize as
    // currently active) — that must never stop the pointer from being
    // tracked below, just lose the "keep receiving events outside bounds"
    // guarantee for that one pointer.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignored — see comment above
    }
    setIsInteracting(true);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStartDist.current = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartScale.current = scale;
      panState.current = null;
    } else if (pointers.current.size === 1 && scale > 1) {
      panState.current = { startX: e.clientX, startY: e.clientY, originX: translate.x, originY: translate.y };
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStartDist.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setScale(clampScale(pinchStartScale.current * (dist / pinchStartDist.current)));
    } else if (panState.current && scale > 1) {
      setTranslate({
        x: panState.current.originX + (e.clientX - panState.current.startX),
        y: panState.current.originY + (e.clientY - panState.current.startY),
      });
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStartDist.current = null;
    if (pointers.current.size === 0) {
      panState.current = null;
      setIsInteracting(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && scale === 1) handleOpenChange(false);
  }

  return (
    <Dialog open={!!src} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-none w-screen h-[100dvh] max-h-none top-0 left-0 translate-x-0 translate-y-0 rounded-none border-0 p-0 bg-black/95 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">Scroll or pinch to zoom, drag to pan once zoomed, double-click or double-tap to reset.</DialogDescription>
        {src && (
          <div
            className="w-full h-full flex items-center justify-center touch-none select-none"
            style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleBackdropClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transition: isInteracting ? "none" : "transform 0.08s ease-out",
              }}
              draggable={false}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The three master canvases V1 renders to — the converging "universal
 * vertical", "universal square", and Pinterest's distinctive 2:3, per
 * research/catalogue-to-campaign.html's platform-adaptation findings
 * (Part 4.5/7). Platform-specific crops beyond these three are a later
 * phase, not V1.
 */
import type { Canvas, CanvasKey } from "./types";

export const CANVASES: Record<CanvasKey, Canvas> = {
  square: { key: "square", label: "Square (1:1) — Instagram/Facebook feed", width: 1080, height: 1080 },
  vertical: { key: "vertical", label: "Vertical (4:5) — Instagram/Facebook feed & Story", width: 1080, height: 1350 },
  pinterest: { key: "pinterest", label: "Pinterest (2:3)", width: 1000, height: 1500 },
};

export function resolveCanvas(key: CanvasKey): Canvas {
  return CANVASES[key];
}

export function isCanvasKey(value: string): value is CanvasKey {
  return value in CANVASES;
}

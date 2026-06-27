"use client";

/**
 * Backdrop chooser — the studio environment for generated model images.
 *
 * Shown only for the prompt-based catalogue path (Gemini / Automatic); the
 * caller hides it for Quick listing and Sharp Fit (Vertex), which use the
 * reference-model studios as-is.
 *
 * Three peer chips: "Smart match", "Choose", "Custom" (locked, future).
 *  • Smart match CALIBRATES a backdrop from the product's colour via the same
 *    deterministic scorer the engine uses at generation time (no AI) — it does
 *    NOT echo the saved Choose colour. A brief calibrating state makes the
 *    reasoning feel deliberate.
 *  • Choose retains the last manually-picked preset (persisted by the caller).
 *
 * Selection styling mirrors the sibling chips (logo indigo→purple theme).
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Sparkles, LayoutGrid, Lock, Loader2 } from "lucide-react";
import type { BackdropMode } from "@/lib/model-gen/backdrops";
import { scoreBackdrops } from "@/lib/model-gen/backdrop-match";

export interface BackdropSwatchView {
  wall: string;
  wallDeep: string;
  floor: string;
  vignette: string;
}

export interface BackdropOption {
  id: string;
  label: string;
  tag?: string;
  swatch: BackdropSwatchView;
}

export interface BackdropValue {
  mode: BackdropMode;
  presetId: string;
}

interface Props {
  presets: BackdropOption[];
  value: BackdropValue;
  onChange: (next: BackdropValue) => void;
  /** Product colour (extracted/entered) — drives Smart match calibration. */
  productColor?: string;
}

const TILE_SELECTED = "border-indigo-400 ring-2 ring-purple-200 scale-[1.02] shadow-sm";
const TILE_IDLE = "border-gray-200 hover:border-gray-300";

/** A miniature studio: soft top-down light + wall→floor sweep + vignette. */
function StudioPreview({ swatch, className = "" }: { swatch: BackdropSwatchView; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(180deg, ${swatch.wall} 0%, ${swatch.wallDeep} 62%, ${swatch.floor} 73%, ${swatch.floor} 100%)`,
        boxShadow: `inset 0 0 24px ${swatch.vignette}`,
      }}
    >
      <div
        className="absolute -top-5 left-1/2 -translate-x-1/2"
        style={{
          width: "80%",
          height: "70px",
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(255,255,255,0.5), rgba(255,255,255,0))",
        }}
      />
    </div>
  );
}

/** Small inline amber tag, e.g. "Benchmark". */
function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
      {children}
    </span>
  );
}

export default function BackdropSelect({ presets, value, onChange, productColor }: Props) {
  const isSmart = value.mode === "smart";
  const isChoose = value.mode === "preset";

  // Smart match: calibrate from the product colour (same scorer the engine runs).
  const color = productColor?.trim() ?? "";
  const smart = useMemo(() => scoreBackdrops({ color })[0], [color]);
  const smartOption = presets.find((p) => p.id === smart?.preset.id) ?? presets[0];

  // Brief, deliberate calibrating state whenever Smart is active or colour
  // changes. `calibrating` is derived (settledColor lags `color` until the timer
  // fires), so setState only runs inside the async callback — no cascading
  // render from a synchronous setState in the effect body.
  const [settledColor, setSettledColor] = useState<string | null>(null);
  const calibrating = isSmart && settledColor !== color;
  useEffect(() => {
    if (!isSmart || settledColor === color) return;
    const t = setTimeout(() => setSettledColor(color), 650);
    return () => clearTimeout(t);
  }, [isSmart, color, settledColor]);

  // Choose: the last manually-picked preset.
  const chosen = presets.find((p) => p.id === value.presetId) ?? presets[0];

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
      active
        ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 ring-1 ring-purple-200"
        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
    }`;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">Backdrop</p>

      {/* Three peer chips — Smart match · Choose · Custom (locked) */}
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={isSmart} onClick={() => onChange({ ...value, mode: "smart" })} className={chip(isSmart)}>
          <Sparkles className="h-3.5 w-3.5" />
          Smart match
        </button>
        <button
          type="button"
          aria-pressed={isChoose}
          onClick={() => onChange({ mode: "preset", presetId: value.presetId || (presets[0]?.id ?? "") })}
          className={chip(isChoose)}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Choose
        </button>
        <button
          type="button"
          disabled
          title="Upload your store — coming soon"
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-400"
        >
          <Lock className="h-3.5 w-3.5" />
          Custom
          <span className="rounded-full border border-gray-200 bg-gray-50 px-1.5 py-px text-[10px] text-gray-400">Soon</span>
        </button>
      </div>

      {isSmart ? (
        /* Smart match: calibrated pick (with its reasoning), not the saved colour. */
        <div className="mt-3 flex items-center gap-2.5">
          {calibrating ? (
            <>
              <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/40">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700">Calibrating backdrop…</p>
                <p className="mt-0.5 text-[11px] text-gray-400">Matching your product colour</p>
              </div>
            </>
          ) : (
            <>
              <StudioPreview swatch={smartOption.swatch} className={`h-12 w-20 shrink-0 rounded-lg border-2 ${TILE_SELECTED}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium text-gray-800">{smartOption.label}</span>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-px text-[10px] font-medium text-indigo-600">Smart pick</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-gray-400">
                  {color ? smart?.reason : "Add a product colour to calibrate"}
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Choose: 3×2 grid of studio preview tiles. */
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {presets.map((p) => {
            const active = p.id === chosen.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ mode: "preset", presetId: p.id })}
                className="group text-left"
              >
                <StudioPreview swatch={p.swatch} className={`h-14 rounded-xl border-2 transition-all ${active ? TILE_SELECTED : TILE_IDLE}`} />
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-medium text-gray-700">{p.label}</span>
                  {p.tag && <Tag>{p.tag}</Tag>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

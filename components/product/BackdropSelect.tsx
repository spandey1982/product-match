"use client";

/**
 * Backdrop chooser — the studio environment for generated model images.
 *
 * Three peer chips: "Smart match" (auto, the default), "Choose" (reveals the
 * preset grid) and "Custom" (future retailer store studios — visible but
 * locked). Selection styling mirrors the sibling chips in the same card
 * (objective, catalogue style, branding) using the Mentis logo's indigo→purple
 * gradient theme.
 *
 * Presets render as a 3-column grid of compact studio-preview tiles (CSS, no
 * image assets) — large enough to read each studio at a glance, balanced so the
 * section stays a lightweight enhancement. Purely presentational.
 */

import type { ReactNode } from "react";
import { Sparkles, LayoutGrid, Lock } from "lucide-react";
import type { BackdropMode } from "@/lib/model-gen/backdrops";

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

/** Small inline tag, e.g. "Benchmark" — sits beside the name, never below. */
function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
      {children}
    </span>
  );
}

export default function BackdropSelect({ presets, value, onChange }: Props) {
  const isSmart = value.mode === "smart";
  const isChoose = value.mode === "preset";
  const selected = presets.find((p) => p.id === value.presetId) ?? presets[0];

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
        /* Smart match: the auto-picked backdrop, compact. */
        <div className="mt-3 flex items-center gap-2.5">
          {selected && <StudioPreview swatch={selected.swatch} className={`h-12 w-20 shrink-0 rounded-lg border-2 ${TILE_SELECTED}`} />}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-medium text-gray-800">{selected?.label}</span>
              {selected?.tag && <Tag>{selected.tag}</Tag>}
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">Auto-picked per product.</p>
          </div>
        </div>
      ) : (
        /* Choose: 3×2 grid of studio preview tiles. */
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {presets.map((p) => {
            const active = p.id === value.presetId;
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

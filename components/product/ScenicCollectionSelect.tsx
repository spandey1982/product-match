"use client";

/**
 * Scenic Collection chooser — contextual environments grouped into Brand Pack
 * rows, with an Intensity/Density panel for the selected scene.
 *
 * Mirrors `BackdropSelect.tsx`'s visual language (chip styling, CSS-rendered
 * preview tiles, the amber `Tag` treatment) so it reads as a sibling of the
 * Studio chooser, not a new UI paradigm. Scenes are grouped into horizontally
 * scrollable Brand Pack rows so 8+ scenes stay compact instead of one long
 * grid; only the selected scene's Intensity/Density controls are shown, and
 * Density is hidden entirely for "consistent" scenes (Boutique/Corporate),
 * which always render their one curated layout.
 */

import type { ReactNode } from "react";
import type { SceneOptionView } from "@/lib/model-gen/scenes/library";
import type { SceneDensity, SceneIntensity } from "@/lib/model-gen/scenes/types";
import { recommendScenes, type SceneSignals } from "@/lib/model-gen/scenes/rule-engine";
import { SCENES } from "@/lib/model-gen/scenes/library";

export interface ScenicValue {
  sceneId: string;
  intensity: SceneIntensity;
  density: SceneDensity;
}

interface BrandPackMeta {
  id: string;
  label: string;
}

interface Props {
  scenes: SceneOptionView[];
  brandPacks: BrandPackMeta[];
  value: ScenicValue;
  onChange: (next: ScenicValue) => void;
  /** Product signals — drives the lightweight "Suggested" badge (no AI call). */
  productSignals: SceneSignals;
}

const TILE_SELECTED = "border-indigo-400 ring-2 ring-purple-200 scale-[1.02] shadow-sm";
const TILE_IDLE = "border-gray-200 hover:border-gray-300";

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">
      {children}
    </span>
  );
}

/** A miniature scene preview: two-tone gradient, no image assets. */
function ScenePreview({ base, accent, className = "" }: { base: string; accent: string; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(160deg, ${base} 0%, ${accent} 100%)` }}
    >
      <div
        className="absolute -top-4 left-1/2 -translate-x-1/2"
        style={{
          width: "70%",
          height: "60px",
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(255,255,255,0.35), rgba(255,255,255,0))",
        }}
      />
    </div>
  );
}

const segmentBtn = (active: boolean) =>
  `flex-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${
    active
      ? "bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 ring-1 ring-purple-200"
      : "text-gray-500 hover:text-gray-700"
  }`;

export default function ScenicCollectionSelect({ scenes, brandPacks, value, onChange, productSignals }: Props) {
  const selected = scenes.find((s) => s.id === value.sceneId) ?? scenes[0];
  const selectedScene = SCENES.find((s) => s.id === selected?.id);
  const recommended = new Set(recommendScenes(productSignals).slice(0, 2).map((r) => r.scene.id));

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">Scenic Collection</p>

      <div className="space-y-3">
        {brandPacks.map((pack) => {
          const packScenes = scenes.filter((s) => s.brandPack === pack.id);
          if (packScenes.length === 0) return null;
          return (
            <div key={pack.id}>
              <p className="text-[11px] font-medium text-gray-400 mb-1.5">{pack.label}</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {packScenes.map((s) => {
                  const active = s.id === value.sceneId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ ...value, sceneId: s.id })}
                      className="group shrink-0 text-left"
                      style={{ width: "88px" }}
                    >
                      <ScenePreview
                        base={s.swatchBase}
                        accent={s.swatchAccent}
                        className={`h-14 rounded-xl border-2 transition-all ${active ? TILE_SELECTED : TILE_IDLE}`}
                      />
                      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                        <span className="truncate text-[11px] font-medium text-gray-700">{s.label}</span>
                        {recommended.has(s.id) && <Tag>Suggested</Tag>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedScene && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
          <p className="text-[11px] font-medium text-gray-500 mb-1.5">Intensity</p>
          <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-gray-200">
            {(["minimal", "balanced", "editorial"] as SceneIntensity[]).map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={value.intensity === level}
                onClick={() => onChange({ ...value, intensity: level })}
                className={segmentBtn(value.intensity === level)}
              >
                {level}
              </button>
            ))}
          </div>

          {selectedScene.variationPolicy === "varies" && (
            <>
              <p className="text-[11px] font-medium text-gray-500 mt-3 mb-1.5">Density</p>
              <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-gray-200">
                {(["minimal", "classic", "rich"] as SceneDensity[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={value.density === level}
                    onClick={() => onChange({ ...value, density: level })}
                    className={segmentBtn(value.density === level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

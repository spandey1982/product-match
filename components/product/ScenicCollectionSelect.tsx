"use client";

/**
 * Scenic chooser — contextual environments, browsed two levels deep so the
 * control stays compact as the library grows past today's 8 scenes:
 *  1. Collection (Brand Pack) — one row of chips, always visible. Switching
 *     collections is how a retailer "goes back" — there's no hidden state.
 *  2. Scene — one row of chips for the active collection only.
 *
 * Each scene chip carries an icon + accent colour (there's no real photo to
 * preview, so a rendered gradient tile wasn't a meaningful thumbnail) plus a
 * label. A lightweight "Suggested" row above both levels surfaces the
 * metadata-driven top pick directly — it has to be reachable in one tap even
 * when it lives in a collection the retailer hasn't opened.
 */

import { useState } from "react";
import {
  Gem, Flame, Moon, Sun, Snowflake, ShoppingBag, Aperture, Briefcase, Sparkles,
  type LucideIcon,
} from "lucide-react";
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
  /** Product signals — drives the lightweight "Suggested" row (no AI call). */
  productSignals: SceneSignals;
}

const SCENE_ICONS: Record<string, LucideIcon> = {
  Gem, Flame, Moon, Sun, Snowflake, ShoppingBag, Aperture, Briefcase,
};

/** Laymen-friendly copy for the technical SceneIntensity/SceneDensity values. */
const PRESENCE_LABELS: Record<SceneIntensity, string> = {
  minimal: "Subtle",
  balanced: "Balanced",
  editorial: "Bold",
};
const DETAIL_LABELS: Record<SceneDensity, string> = {
  minimal: "Simple",
  classic: "Classic",
  rich: "Rich",
};

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const flatChip = (active: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
    active
      ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 ring-1 ring-purple-200"
      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
  }`;

export default function ScenicCollectionSelect({ scenes, brandPacks, value, onChange, productSignals }: Props) {
  const selectedOption = scenes.find((s) => s.id === value.sceneId) ?? scenes[0];
  const selectedScene = SCENES.find((s) => s.id === selectedOption?.id);
  const [activePack, setActivePack] = useState(selectedOption?.brandPack ?? brandPacks[0]?.id);

  const recommended = recommendScenes(productSignals).slice(0, 2);
  const recommendedIds = new Set(recommended.map((r) => r.scene.id));
  const packsWithSuggestion = new Set(recommended.map((r) => r.scene.brandPack));

  function selectScene(scene: SceneOptionView) {
    setActivePack(scene.brandPack);
    onChange({ ...value, sceneId: scene.id });
  }

  const packScenes = scenes.filter((s) => s.brandPack === activePack);

  return (
    <div>
      {recommended.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {recommended.map(({ scene }) => {
            const Icon = SCENE_ICONS[scene.theme.icon] ?? Sparkles;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => selectScene({ id: scene.id, label: scene.label, brandPack: scene.brandPack, variationPolicy: scene.variationPolicy, icon: scene.theme.icon, color: scene.theme.color })}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:border-amber-300"
              >
                <Sparkles className="h-3 w-3" />
                Suggested: {scene.label}
                <Icon className="h-3 w-3" />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {brandPacks.map((pack) => {
          const active = pack.id === activePack;
          const hasSuggestion = !active && packsWithSuggestion.has(pack.id);
          return (
            <button
              key={pack.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setActivePack(pack.id);
                const first = scenes.find((s) => s.brandPack === pack.id);
                if (first && first.brandPack !== selectedOption?.brandPack) selectScene(first);
              }}
              className={`relative ${flatChip(active)}`}
            >
              {pack.label.replace(" Collection", "")}
              {hasSuggestion && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {packScenes.map((s) => {
          const Icon = SCENE_ICONS[s.icon] ?? Sparkles;
          const active = s.id === value.sceneId;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectScene(s)}
              style={
                active
                  ? { borderColor: s.color, background: hexToRgba(s.color, 0.08), color: s.color }
                  : undefined
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                active ? "" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" style={active ? { color: s.color } : undefined} />
              {s.label}
              {recommendedIds.has(s.id) && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </button>
          );
        })}
      </div>

      {selectedScene && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">How much the scene shows</p>
          <div className="flex flex-wrap gap-2">
            {(["minimal", "balanced", "editorial"] as SceneIntensity[]).map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={value.intensity === level}
                onClick={() => onChange({ ...value, intensity: level })}
                className={flatChip(value.intensity === level)}
              >
                {PRESENCE_LABELS[level]}
              </button>
            ))}
          </div>

          {selectedScene.variationPolicy === "varies" && (
            <>
              <p className="text-xs font-medium text-gray-500 mt-3 mb-2">How much is going on in the scene</p>
              <div className="flex flex-wrap gap-2">
                {(["minimal", "classic", "rich"] as SceneDensity[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={value.density === level}
                    onClick={() => onChange({ ...value, density: level })}
                    className={flatChip(value.density === level)}
                  >
                    {DETAIL_LABELS[level]}
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

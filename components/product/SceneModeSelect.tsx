"use client";

/**
 * Top-level Scene chooser: Studio (existing flat backdrops) vs Scenic (new
 * contextual environments). "Scene" is the umbrella label explaining why this
 * whole control exists — it's the environment behind the model in the shot,
 * plain (Studio) or contextually designed (Scenic).
 *
 * Restructures the MOUNT POINT only — `BackdropSelect`'s three Studio chips
 * (Smart match / Choose / Custom) are unchanged, zero regression risk. When
 * Scenic is disabled for this environment (`ENABLE_SCENIC_COLLECTION` off),
 * its chip is locked with a "Soon" badge, same treatment as the existing
 * locked "Custom" chip.
 */

import { Layers, Mountain, Lock } from "lucide-react";
import BackdropSelect, { type BackdropOption, type BackdropValue } from "./BackdropSelect";
import ScenicCollectionSelect, { type ScenicValue } from "./ScenicCollectionSelect";
import type { SceneOptionView } from "@/lib/model-gen/scenes/library";
import type { SceneSignals } from "@/lib/model-gen/scenes/rule-engine";

export type BackdropSection = "studio" | "scenic";

interface Props {
  section: BackdropSection;
  onSectionChange: (next: BackdropSection) => void;
  scenicEnabled: boolean;

  backdrops: BackdropOption[];
  backdropValue: BackdropValue;
  onBackdropChange: (next: BackdropValue) => void;
  productColor?: string;

  scenes: SceneOptionView[];
  brandPacks: { id: string; label: string }[];
  scenicValue: ScenicValue;
  onScenicChange: (next: ScenicValue) => void;
  productSignals: SceneSignals;
}

const chip = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
    active
      ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 ring-1 ring-purple-200"
      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
  }`;

export default function SceneModeSelect({
  section,
  onSectionChange,
  scenicEnabled,
  backdrops,
  backdropValue,
  onBackdropChange,
  productColor,
  scenes,
  brandPacks,
  scenicValue,
  onScenicChange,
  productSignals,
}: Props) {
  const isStudio = section === "studio";
  const isScenic = section === "scenic" && scenicEnabled;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">Scene</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          aria-pressed={isStudio}
          onClick={() => onSectionChange("studio")}
          className={chip(isStudio)}
        >
          <Layers className="h-3.5 w-3.5" />
          Studio
        </button>
        {scenicEnabled ? (
          <button
            type="button"
            aria-pressed={isScenic}
            onClick={() => onSectionChange("scenic")}
            className={chip(isScenic)}
          >
            <Mountain className="h-3.5 w-3.5" />
            Scenic
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="Contextual scenes — coming soon"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-400"
          >
            <Lock className="h-3.5 w-3.5" />
            Scenic
            <span className="rounded-full border border-gray-200 bg-gray-50 px-1.5 py-px text-[10px] text-gray-400">Soon</span>
          </button>
        )}
      </div>

      {isScenic ? (
        <ScenicCollectionSelect
          scenes={scenes}
          brandPacks={brandPacks}
          value={scenicValue}
          onChange={onScenicChange}
          productSignals={productSignals}
        />
      ) : (
        <BackdropSelect
          presets={backdrops}
          value={backdropValue}
          onChange={onBackdropChange}
          productColor={productColor}
        />
      )}
    </div>
  );
}

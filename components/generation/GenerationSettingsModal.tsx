"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SignatureModelOption } from "./CastingChooser";
import type { BackdropOption } from "@/components/product/BackdropSelect";
import type { ScenicValue } from "@/components/product/ScenicCollectionSelect";
import type { SceneOptionView } from "@/lib/model-gen/scenes/library";
import { DEFAULT_GENERATION_QUALITY, type GenerationQuality } from "@/lib/model-gen/quality";
import { DEFAULT_IMAGE_GEN_MODEL, type ImageGenModel } from "@/lib/model-gen/image-gen-models";
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";

export interface GenerationSettings {
  objective: string;
  quality: GenerationQuality;
  /** Image-generation model — internal testing knob. */
  model?: ImageGenModel;
  backdropSection?: "studio" | "scenic";
  /** Explicit studio preset id — sent when backdropSection is "studio". */
  backdropPresetId?: string;
  /** Explicit scenic scene id — sent when backdropSection is "scenic". */
  sceneId?: string;
  signatureProfileId?: string;
  useCasting?: boolean;
  mode?: "resume" | "recreate";
}

interface ObjectiveOption {
  id: string;
  label: string;
}

interface SettingsData {
  enabled: boolean;
  objectives: ObjectiveOption[];
  backdrops: BackdropOption[];
  scenes: SceneOptionView[];
  brandPacks: { id: string; label: string }[];
  scenicEnabled: boolean;
  castingEnabled?: boolean;
  signatureModels?: SignatureModelOption[];
  imageGenModels?: { id: ImageGenModel; label: string }[];
  settings: {
    defaultObjective: string;
    catalogueProvider: "gemini" | "vertex";
    quality: GenerationQuality;
    imageGenModel?: ImageGenModel;
    backdrop: { mode: string; presetId: string };
    scenic: ScenicValue;
  };
}

interface GenerationSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productTitle: string;
  productColor?: string;
  productCategory?: string;
  hasDetailNotes: boolean;
  hasGI: boolean;
  onGenerate: (settings: GenerationSettings) => void;
  generating: boolean;
  hasGeneratedImages?: boolean;
  /** True when all expected catalogue views (front + back) already exist. */
  catalogueComplete?: boolean;
}

async function fetchSettingsData(): Promise<SettingsData | null> {
  const res = await fetch("/api/settings/ai-generation");
  if (!res.ok) return null;
  return res.json();
}

export function useGenerationSettingsModal() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(false);

  const openModal = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    try {
      const result = await fetchSettingsData();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setData(null);
  }, []);

  return { open, data, loading, openModal, closeModal, setOpen: (next: boolean) => {
    if (next) openModal();
    else closeModal();
  }};
}

function Chip({
  active,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
        disabled
          ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
          : active
            ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 ring-1 ring-purple-200"
            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

/** Label on the left, a row of chips on the right — Style / Model style / Quality. */
function ChipRow<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-gray-700 shrink-0">{label}</label>
      <div className="flex flex-wrap justify-end gap-2">
        {options.map((o) => (
          <Chip key={o.value} active={value === o.value} disabled={disabled} onClick={() => onChange(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function CompactSelect<T extends string>({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      className={`rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 outline-none min-w-[140px] ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function GenerationSettingsModal({
  open,
  onOpenChange,
  productTitle,
  hasDetailNotes,
  hasGI,
  onGenerate,
  generating,
  hasGeneratedImages = false,
  catalogueComplete = false,
  settingsData,
  settingsLoading,
}: GenerationSettingsModalProps & {
  settingsData: SettingsData | null;
  settingsLoading: boolean;
}) {
  const data = settingsData;
  const loading = settingsLoading;

  const [objective, setObjective] = useState("catalogue");
  const [quality, setQuality] = useState<GenerationQuality>(DEFAULT_GENERATION_QUALITY);
  const [model, setModel] = useState<ImageGenModel>(DEFAULT_IMAGE_GEN_MODEL);
  const [backdropSection, setBackdropSection] = useState<"studio" | "scenic">("studio");
  const [backdropPresetId, setBackdropPresetId] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [modelMode, setModelMode] = useState<"classic" | "personalised">("personalised");
  const [castingSelection, setCastingSelection] = useState("auto");

  const resetToDefaults = useCallback((d: SettingsData) => {
    setObjective(d.settings.defaultObjective ?? "catalogue");
    setQuality(d.settings.quality ?? DEFAULT_GENERATION_QUALITY);
    setModel(d.settings.imageGenModel ?? DEFAULT_IMAGE_GEN_MODEL);
    setBackdropSection("studio");
    // Pre-select the retailer's saved defaults, but every field stays
    // explicit and editable right here — this modal no longer relies on a
    // pick persisted from when the product was first added (that carryover
    // wasn't applying reliably on Resume/Recreate).
    setBackdropPresetId(d.settings.backdrop.presetId || d.backdrops[0]?.id || "");
    setSceneId(d.settings.scenic.sceneId || d.scenes[0]?.id || "");
    setCastingSelection("auto");
  }, []);

  const prevData = useState<SettingsData | null>(null);
  if (data && data !== prevData[0]) {
    prevData[1](data);
    resetToDefaults(data);
  }

  const isGemini = data?.settings.catalogueProvider === "gemini";
  const isCatalogue = objective === "catalogue";
  const showModelMode = data?.castingEnabled && isGemini;
  const showCasting = showModelMode && modelMode === "personalised" && isCatalogue;
  const showScene = isCatalogue && isGemini && data?.scenicEnabled;
  const showQuality = isGemini;
  const hasCachedIntelligence = hasDetailNotes || hasGI;

  const objectiveOptions = (data?.objectives ?? []).map((o) => ({
    value: o.id,
    label: o.label,
  }));

  const modelModeOptions = [
    { value: "personalised" as const, label: "Personalised" },
    { value: "classic" as const, label: "Classic" },
  ];

  const castingOptions = [
    { value: "auto", label: "Auto" },
    ...(data?.signatureModels ?? []).map((m) => ({
      value: m.id,
      label: m.name,
    })),
  ];

  const backdropDropdownOptions = (data?.backdrops ?? []).map((b) => ({
    value: b.id,
    label: b.label,
  }));

  const sceneDropdownOptions = (data?.scenes ?? []).map((s) => ({
    value: s.id,
    label: s.label,
  }));

  const qualityOptions = [
    { value: "standard" as const, label: "Standard" },
    { value: "enhanced" as const, label: "Enhanced" },
  ];

  const modelOptions = (data?.imageGenModels ?? []).map((m) => ({
    value: m.id,
    label: m.label,
  }));

  const styleLocked = hasGeneratedImages;

  function handleAction(mode: "resume" | "recreate") {
    const settings: GenerationSettings = {
      objective,
      quality,
      backdropSection: showScene ? backdropSection : undefined,
      backdropPresetId: showScene && backdropSection === "studio" ? backdropPresetId : undefined,
      sceneId: showScene && backdropSection === "scenic" ? sceneId : undefined,
      signatureProfileId:
        showCasting && castingSelection !== "auto" ? castingSelection : undefined,
      useCasting: modelMode === "personalised",
      model: isGemini ? model : undefined,
      mode,
    };
    onGenerate(settings);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
            Generation Settings
          </DialogTitle>
          <DialogDescription className="truncate">{productTitle}</DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {hasCachedIntelligence && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-700 leading-snug">
                  {hasGI && hasDetailNotes
                    ? "Intelligence & metadata cached — won't be re-billed."
                    : hasGI
                      ? "Garment intelligence cached — won't be re-billed."
                      : "Metadata cached — won't be re-billed."}
                </p>
              </div>
            )}

            {data.enabled && objectiveOptions.length > 1 && (
              <ChipRow label="Style" value={objective} onChange={setObjective} options={objectiveOptions} disabled={styleLocked} />
            )}

            {showScene && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-700 shrink-0">Scene</label>
                  <div className="flex gap-2">
                    <Chip active={backdropSection === "studio"} onClick={() => setBackdropSection("studio")}>
                      Studio
                    </Chip>
                    <Chip active={backdropSection === "scenic"} onClick={() => setBackdropSection("scenic")}>
                      Scenic
                    </Chip>
                  </div>
                </div>
                <div className="flex justify-end">
                  {backdropSection === "studio" ? (
                    <CompactSelect
                      value={backdropPresetId}
                      onChange={setBackdropPresetId}
                      options={backdropDropdownOptions}
                    />
                  ) : (
                    <CompactSelect
                      value={sceneId}
                      onChange={setSceneId}
                      options={sceneDropdownOptions}
                    />
                  )}
                </div>
              </div>
            )}

            {showModelMode && (
              <div className="space-y-2">
                <ChipRow label="Model style" value={modelMode} onChange={setModelMode} options={modelModeOptions} />
                {/* No label here by design — this dropdown reads as part of
                    the "Model style" row above it, not a separate setting.
                    Frozen (disabled) under Classic; live under Personalised. */}
                <div className="flex justify-end">
                  <CompactSelect
                    value={castingSelection}
                    onChange={setCastingSelection}
                    options={castingOptions}
                    disabled={!showCasting}
                  />
                </div>
              </div>
            )}

            {showQuality && (
              <ChipRow label="Quality" value={quality} onChange={setQuality} options={qualityOptions} />
            )}

            {isGemini && modelOptions.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-gray-700 shrink-0">
                  Test model
                </label>
                <CompactSelect value={model} onChange={setModel} options={modelOptions} />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {hasGeneratedImages ? (
            <Button
              variant="outline"
              onClick={() => handleAction("resume")}
              disabled={loading || !data || generating || catalogueComplete}
              loading={generating}
              className="rounded-xl"
              title={catalogueComplete ? "All catalogue images are complete" : undefined}
            >
              {generating ? "Generating…" : catalogueComplete ? "Complete" : "Resume"}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={generating}
              className="rounded-xl"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={() => handleAction("recreate")}
            disabled={loading || !data || generating}
            loading={generating}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
          >
            {generating ? "Generating…" : hasGeneratedImages ? "Recreate" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

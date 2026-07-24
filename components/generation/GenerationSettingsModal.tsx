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
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";

export interface GenerationSettings {
  objective: string;
  quality: GenerationQuality;
  backdropSection?: "studio" | "scenic";
  signatureProfileId?: string;
  useCasting?: boolean;
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
  settings: {
    defaultObjective: string;
    catalogueProvider: "gemini" | "vertex";
    quality: GenerationQuality;
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

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-gray-700 shrink-0">{label}</label>
      {children}
    </div>
  );
}

function CompactSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 outline-none min-w-[140px]"
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
  const [backdropSection, setBackdropSection] = useState<"studio" | "scenic">("studio");
  const [modelMode, setModelMode] = useState<"classic" | "personalised">("personalised");
  const [castingSelection, setCastingSelection] = useState("auto");

  const resetToDefaults = useCallback((d: SettingsData) => {
    setObjective(d.settings.defaultObjective ?? "catalogue");
    setQuality(d.settings.quality ?? DEFAULT_GENERATION_QUALITY);
    setBackdropSection("studio");
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

  const sceneOptions = [
    { value: "studio" as const, label: "Studio" },
    { value: "scenic" as const, label: "Scenic" },
  ];

  const qualityOptions = [
    { value: "standard" as const, label: "Standard (1K)" },
    { value: "enhanced" as const, label: "Enhanced (2K)" },
  ];

  function handleGenerate() {
    const settings: GenerationSettings = {
      objective,
      quality,
      backdropSection: showScene ? backdropSection : undefined,
      signatureProfileId:
        showCasting && castingSelection !== "auto" ? castingSelection : undefined,
      useCasting: modelMode === "personalised",
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
              <SettingsRow label="Style">
                <CompactSelect value={objective} onChange={setObjective} options={objectiveOptions} />
              </SettingsRow>
            )}

            {showScene && (
              <SettingsRow label="Scene">
                <CompactSelect value={backdropSection} onChange={setBackdropSection} options={sceneOptions} />
              </SettingsRow>
            )}

            {showModelMode && (
              <SettingsRow label="Model style">
                <CompactSelect value={modelMode} onChange={setModelMode} options={modelModeOptions} />
              </SettingsRow>
            )}

            {showCasting && castingOptions.length > 1 && (
              <SettingsRow label="Model">
                <CompactSelect value={castingSelection} onChange={setCastingSelection} options={castingOptions} />
              </SettingsRow>
            )}

            {showQuality && (
              <SettingsRow label="Quality">
                <CompactSelect value={quality} onChange={setQuality} options={qualityOptions} />
              </SettingsRow>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generating}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || !data || generating}
            loading={generating}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
          >
            {generating ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

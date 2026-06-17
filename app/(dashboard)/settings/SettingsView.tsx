"use client";

import { useState } from "react";
import { Sparkles, Check, Loader2, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "gemini" | "vertex" | "auto";

interface ProviderOption {
  id: "gemini" | "vertex";
  label: string;
  enabled: boolean;
}

interface Props {
  current: Mode;
  providers: ProviderOption[];
}

// Friendly, non-technical labels — the headline effect of each choice. The
// underlying ids ("auto"/"gemini"/"vertex") are unchanged and stay internal.
const MODE_LABELS: Record<Mode, string> = {
  auto: "Automatic",
  gemini: "Natural Drape",
  vertex: "Sharp Fit",
};

const DESCRIPTIONS: Record<Mode, string> = {
  auto:
    "Picks the best look for each product automatically — flowing ethnic wear and structured outfits each get the technique that suits them. Best choice for most stores.",
  gemini:
    "Best for sarees, lehengas, dupattas and other draped, flowing wear — recreates folds and draping the most realistically. Works for every product.",
  vertex:
    "Best for stitched, structured and western outfits and footwear — gives clean, true-to-fit results on tailored pieces.",
};

interface ModeOption {
  id: Mode;
  label: string;
  enabled: boolean;
}

export function SettingsView({ current, providers }: Props) {
  const [selected, setSelected] = useState<Mode>(current);
  const [saving, setSaving] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // "Auto" first, then each concrete provider. Auto is always selectable.
  const options: ModeOption[] = [
    { id: "auto", label: "Automatic", enabled: true },
    ...providers,
  ];

  async function choose(id: Mode) {
    if (id === selected || saving) return;
    setError(null);
    setSaved(false);
    setSaving(id);
    try {
      const res = await fetch("/api/settings/tryon-provider", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update the provider. Please try again.");
        return;
      }
      setSelected(data.provider as Mode);
      setSaved(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  function savedLabel(mode: Mode): string {
    if (mode === "auto") return "the best look for each product";
    return `the ${MODE_LABELS[mode]} style`;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      <p className="text-sm text-gray-500 mt-1">
        Configure how your store generates virtual try-ons.
      </p>

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Try-On Style
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          How virtual try-ons are created for your store. Automatic suits most
          stores; pick a specific style to always use it instead.
        </p>

        <div className="space-y-3">
          {options.map((p) => {
            const isSelected = selected === p.id;
            const isSaving = saving === p.id;
            const disabled = !p.enabled;

            return (
              <button
                key={p.id}
                onClick={() => choose(p.id)}
                disabled={disabled || isSaving}
                aria-pressed={isSelected}
                className={cn(
                  "w-full text-left rounded-2xl border p-4 transition-all",
                  "flex items-start gap-3",
                  isSelected
                    ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200"
                    : "border-gray-100 bg-white hover:border-gray-200",
                  disabled && "opacity-60 cursor-not-allowed hover:border-gray-100"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center shrink-0",
                    isSelected
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-gray-300 bg-white"
                  )}
                >
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                  ) : isSelected ? (
                    <Check className="h-3 w-3" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {MODE_LABELS[p.id]}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-indigo-600">
                        Active
                      </span>
                    )}
                    {p.id === "auto" && !isSelected && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                        Recommended
                      </span>
                    )}
                    {disabled && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        <Lock className="h-3 w-3" />
                        Unavailable
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {DESCRIPTIONS[p.id]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mt-3 text-xs text-green-600 flex items-center gap-1">
            <Check className="h-3.5 w-3.5 shrink-0" />
            Saved. New try-ons will use {savedLabel(selected)}.
          </p>
        )}
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Sparkles, Check, Loader2, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type ProviderId = "gemini" | "vertex";

interface ProviderOption {
  id: ProviderId;
  label: string;
  enabled: boolean;
}

interface Props {
  current: ProviderId;
  providers: ProviderOption[];
}

const DESCRIPTIONS: Record<ProviderId, string> = {
  gemini:
    "Google Gemini image model. The default provider — always available when the Gemini API key is configured.",
  vertex:
    "Google Cloud Vertex AI Virtual Try-On (virtual-try-on-001). Requires Vertex to be enabled and credentials configured.",
};

export function SettingsView({ current, providers }: Props) {
  const [selected, setSelected] = useState<ProviderId>(current);
  const [saving, setSaving] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function choose(id: ProviderId) {
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
      setSelected(data.provider as ProviderId);
      setSaved(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(null);
    }
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
            Virtual Try-On Provider
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          The AI engine used when shoppers try on your products. Gemini is the
          default; other providers appear here once configured.
        </p>

        <div className="space-y-3">
          {providers.map((p) => {
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
                      {p.label}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-indigo-600">
                        Active
                      </span>
                    )}
                    {disabled && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        <Lock className="h-3 w-3" />
                        Not configured
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
            Saved. New try-ons will use {selected === "vertex" ? "Vertex AI" : "Gemini"}.
          </p>
        )}
      </section>
    </div>
  );
}

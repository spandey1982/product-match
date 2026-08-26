"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/lib/client-modules";

const MODULE_LABELS: Record<ModuleKey, string> = {
  catalog: "Catalog",
  upload: "Add Product",
  "trial-room": "Virtual Trial Room",
  "design-studio": "Design Studio",
  "auto-catalog": "Autonomous Catalog",
  "model-studio": "Model Studio",
  wishlist: "Wishlist",
};

// Keep in sync with PROMOTABLE_NAV in components/layout/Navbar.tsx — only
// modules with a defined promoted nav slot can be set as primaryModule.
const PROMOTABLE_MODULES: ModuleKey[] = ["design-studio"];

const THEME_PRESET_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Default — Mentis indigo/purple" },
  { value: "royal", label: "Royal — rich, ornate, luxury" },
  { value: "elegant", label: "Elegant — minimal, quiet-luxury" },
];

interface Profile {
  enabledModules: ModuleKey[];
  primaryModule: ModuleKey;
  brandName: string | null;
  themePreset: string;
  accentColor: string | null;
}

interface Props {
  userId: string;
  initialLogoUrl: string | null;
  allModules: ModuleKey[];
  initialProfile: Profile | null;
}

export function ClientProfileForm({ userId, initialLogoUrl, allModules, initialProfile }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [enabledModules, setEnabledModules] = useState<Set<ModuleKey>>(
    new Set(initialProfile?.enabledModules ?? allModules)
  );
  const [primaryModule, setPrimaryModule] = useState<ModuleKey>(initialProfile?.primaryModule ?? "catalog");
  const [brandName, setBrandName] = useState(initialProfile?.brandName ?? "");
  const [themePreset, setThemePreset] = useState(initialProfile?.themePreset ?? "default");
  const [accentColor, setAccentColor] = useState(initialProfile?.accentColor ?? "");
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ preset: string; reasoning: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function toggleModule(key: ModuleKey) {
    setEnabledModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledModules: [...enabledModules],
          primaryModule,
          brandName: brandName.trim() || null,
          themePreset,
          accentColor: accentColor || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveProfile() {
    if (!confirm("Remove this custom profile? The account will go back to the default, unrestricted experience.")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove profile");
      setEnabledModules(new Set(allModules));
      setPrimaryModule("catalog");
      setBrandName("");
      setThemePreset("default");
      setAccentColor("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoFile(file: File) {
    setUploadingLogo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("logo", file);
      const res = await fetch(`/api/admin/clients/${userId}/logo`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Logo upload failed");
      setLogoUrl(data.logoUrl);
      if (!accentColor && data.suggestedAccentColor) {
        setAccentColor(data.suggestedAccentColor);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleLogoDelete() {
    setUploadingLogo(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${userId}/logo`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove logo");
      setLogoUrl(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSuggestTheme() {
    setSuggesting(true);
    setError(null);
    setSuggestion(null);
    try {
      const res = await fetch(`/api/admin/clients/${userId}/suggest-theme`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suggestion failed");
      setSuggestion(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {/* Modules */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Enabled modules</h2>
        <p className="text-xs text-gray-500 mb-4">
          Unchecked modules 404 on the page and 403 on the API for this account, and disappear from nav.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {allModules.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={enabledModules.has(m)}
                onChange={() => toggleModule(m)}
                className="rounded border-gray-300"
              />
              {MODULE_LABELS[m]}
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Promoted (primary) module</label>
          <select
            value={primaryModule}
            onChange={(e) => setPrimaryModule(e.target.value as ModuleKey)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="catalog">None — keep default top-level nav</option>
            {PROMOTABLE_MODULES.filter((m) => enabledModules.has(m)).map((m) => (
              <option key={m} value={m}>{MODULE_LABELS[m]}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Branding */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Branding</h2>

        <div className="flex items-center gap-4 mb-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Client logo" className="h-14 w-14 rounded-xl object-cover border border-gray-200" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
              No logo
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogoFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
            >
              {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload logo
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleLogoDelete}
                disabled={uploadingLogo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Brand name</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Mentis"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Theme preset</label>
            <select
              value={themePreset}
              onChange={(e) => setThemePreset(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {THEME_PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Accent color <span className="text-gray-400">(overrides the preset&apos;s primary hue only)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accentColor || "#6366f1"}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-9 w-9 rounded border border-gray-200"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder="Uses the preset's default color"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSuggestTheme}
            disabled={suggesting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
          >
            {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Suggest theme with AI
          </button>
          <p className="text-[11px] text-gray-400 mt-1">
            Analyzes the client&apos;s logo + product photos with Gemini. A real paid call — click deliberately.
          </p>
          {suggestion && (
            <div className="mt-3 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-indigo-900">Suggests: {suggestion.preset}</p>
                <p className="text-xs text-indigo-700 mt-0.5">{suggestion.reasoning}</p>
              </div>
              <button
                type="button"
                onClick={() => setThemePreset(suggestion.preset)}
                className="shrink-0 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleRemoveProfile}
          disabled={saving || !initialProfile}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Remove custom profile (revert to default)
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors",
            saving ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
          )}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {savedAt ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

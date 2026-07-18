"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Users, Plus, Trash2, Save, X, Info, Sparkles, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FaceEntry } from "@/lib/model-gen/faces";
import {
  EMPTY_METADATA,
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, EXPRESSIONS,
  BODY_TYPES, PERSONAS,
  PERSONA_DEFAULTS, COMMON_STYLE_TAGS, COMMON_CATEGORIES,
  type CastingMetadata, type PoseMode, type Persona,
} from "@/lib/model-gen/casting-types";

/**
 * Slim summary the server hydrates into initialProfiles. Kept flat because
 * mutations here always go through the API — the row in DB is the source of
 * truth, not this local state.
 */
export interface SignatureModelSummary {
  id: string;
  name: string;
  faceId: string;
  faceLabel: string | null;
  faceThumbnailUrl: string | null;
  metadata: CastingMetadata;
  poseMode: PoseMode | null;
}

interface Props {
  initialProfiles: SignatureModelSummary[];
  faceLibrary: FaceEntry[];
}

const SMART_PICK = "__smart__";
const NEW_PROFILE_ID = "__new__";

/** Human-readable enum labels. Kebab-case → Title Case. */
function label(v: string): string {
  return v
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function smartPickOptions<T extends string>(values: readonly T[]) {
  return [
    { value: SMART_PICK, label: "Smart pick" },
    ...values.map((v) => ({ value: v, label: label(v) })),
  ];
}

/** null ↔ "__smart__" bridging for the Select control. */
function toSel(v: string | null): string {
  return v ?? SMART_PICK;
}
function fromSel<T extends string>(v: string, enumList: readonly T[]): T | null {
  return v === SMART_PICK ? null : (enumList as readonly string[]).includes(v) ? (v as T) : null;
}

export function ModelStudioView({ initialProfiles, faceLibrary }: Props) {
  const [profiles, setProfiles] = useState<SignatureModelSummary[]>(initialProfiles);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Edit form state.
  const [name, setName] = useState("");
  const [faceId, setFaceId] = useState<string>(faceLibrary[0]?.id ?? "");
  const [metadata, setMetadata] = useState<CastingMetadata>({ ...EMPTY_METADATA });
  const [poseMode, setPoseMode] = useState<PoseMode>("studio");

  // Loading / error.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingExisting = editingId !== null && editingId !== NEW_PROFILE_ID;
  const showForm = editingId !== null;

  function startNew() {
    setEditingId(NEW_PROFILE_ID);
    setName("");
    setFaceId(faceLibrary[0]?.id ?? "");
    setMetadata({ ...EMPTY_METADATA });
    setPoseMode("studio");
    setError(null);
  }

  function startEdit(p: SignatureModelSummary) {
    setEditingId(p.id);
    setName(p.name);
    setFaceId(p.faceId);
    setMetadata({ ...p.metadata });
    setPoseMode(p.poseMode ?? "studio");
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setError(null);
  }

  async function save() {
    if (!name.trim()) {
      setError("Please give this Signature Model a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingExisting) {
        const res = await fetch(`/api/model-profiles/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, faceId, metadata, poseMode }),
        });
        if (!res.ok) {
          const { error: msg } = await res.json().catch(() => ({ error: "" }));
          throw new Error(msg || "Save failed");
        }
        const { profile } = await res.json();
        setProfiles((prev) => prev.map((p) => (p.id === profile.id ? profile : p)));
      } else {
        const res = await fetch("/api/model-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, faceId, metadata, poseMode }),
        });
        if (!res.ok) {
          const { error: msg } = await res.json().catch(() => ({ error: "" }));
          throw new Error(msg || "Save failed");
        }
        const { profile } = await res.json();
        setProfiles((prev) => [profile, ...prev]);
      }
      setEditingId(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Apply the current persona's defaults to any field the retailer has left
   * on "Smart pick". Never overwrites explicit choices. Style tags merge with
   * the current selection (deduped) rather than replacing so retailers can
   * layer persona defaults on top of their own tag picks.
   */
  function applyPersonaDefaults() {
    if (!metadata.persona) return;
    const d = PERSONA_DEFAULTS[metadata.persona];
    setMetadata((m) => {
      const mergedTags = m.styleTags && m.styleTags.length > 0
        ? Array.from(new Set([...m.styleTags, ...d.styleTags]))
        : [...d.styleTags];
      return {
        ...m,
        hairStyle:  m.hairStyle  ?? d.hairStyle,
        hairColor:  m.hairColor  ?? d.hairColor,
        expression: m.expression ?? d.expression,
        bodyType:   m.bodyType   ?? d.bodyType,
        styleTags:  mergedTags,
      };
    });
  }

  function toggleStyleTag(tag: string) {
    setMetadata((m) => {
      const current = m.styleTags ?? [];
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      return { ...m, styleTags: next.length > 0 ? next : null };
    });
  }

  function toggleCategory(cat: string) {
    setMetadata((m) => {
      const current = m.categoryAffinity ?? [];
      const next = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat];
      return { ...m, categoryAffinity: next.length > 0 ? next : null };
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this Signature Model? Past catalogue images are unaffected.")) return;
    const res = await fetch(`/api/model-profiles/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) setEditingId(null);
    }
  }

  const femaleFaces = faceLibrary.filter((f) => f.sex === "female");
  const maleFaces = faceLibrary.filter((f) => f.sex === "male");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/assets"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Assets
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-500" />
          Model Studio
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Save a face and appearance brief you can reuse across generations. AI
          Casting will smart-pick anything you don&apos;t override, so a
          Signature Model can be as simple as just picking a face.
        </p>
      </div>

      {/* Gallery */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Signature Models</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
          {profiles.map((p) => (
            <SignatureCard
              key={p.id}
              profile={p}
              active={editingId === p.id}
              onEdit={() => startEdit(p)}
              onDelete={() => remove(p.id)}
            />
          ))}
          <button
            onClick={startNew}
            className="shrink-0 w-40 h-52 rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <Plus className="h-6 w-6" />
            <span className="text-xs font-medium">Add Signature Model</span>
          </button>
        </div>
      </section>

      {/* Form */}
      {showForm && (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              {editingExisting ? "Edit Signature Model" : "New Signature Model"}
            </h2>
            <button
              onClick={cancel}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Input
            label="Name"
            placeholder="e.g. Priya — bridal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />

          {/* Face picker */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Face</label>
            <FacePickerGroup title="Female" faces={femaleFaces} value={faceId} onChange={setFaceId} />
            <FacePickerGroup title="Male" faces={maleFaces} value={faceId} onChange={setFaceId} />
          </div>

          {/* Appearance (with Smart-pick defaults) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Select
                label="Persona"
                value={toSel(metadata.persona)}
                onChange={(e) => setMetadata((m) => ({ ...m, persona: fromSel(e.target.value, PERSONAS) as Persona | null }))}
                options={smartPickOptions(PERSONAS)}
              />
              {metadata.persona && (
                <button
                  type="button"
                  onClick={applyPersonaDefaults}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Apply {label(metadata.persona)} defaults →
                </button>
              )}
            </div>
            <Select
              label="Expression"
              value={toSel(metadata.expression)}
              onChange={(e) => setMetadata((m) => ({ ...m, expression: fromSel(e.target.value, EXPRESSIONS) }))}
              options={smartPickOptions(EXPRESSIONS)}
            />
            <Select
              label="Skin tone"
              value={toSel(metadata.skinTone)}
              onChange={(e) => setMetadata((m) => ({ ...m, skinTone: fromSel(e.target.value, SKIN_TONES) }))}
              options={smartPickOptions(SKIN_TONES)}
            />
            <Select
              label="Body type"
              value={toSel(metadata.bodyType)}
              onChange={(e) => setMetadata((m) => ({ ...m, bodyType: fromSel(e.target.value, BODY_TYPES) }))}
              options={smartPickOptions(BODY_TYPES)}
            />
            <Select
              label="Hair style"
              value={toSel(metadata.hairStyle)}
              onChange={(e) => setMetadata((m) => ({ ...m, hairStyle: fromSel(e.target.value, HAIR_STYLES) }))}
              options={smartPickOptions(HAIR_STYLES)}
            />
            <Select
              label="Hair colour"
              value={toSel(metadata.hairColor)}
              onChange={(e) => setMetadata((m) => ({ ...m, hairColor: fromSel(e.target.value, HAIR_COLORS) }))}
              options={smartPickOptions(HAIR_COLORS)}
            />
          </div>

          {/* Style tags — chip picker. Freeform strings on the wire; a
              curated set here so signature models stay comparable when the
              scorer picks between them. */}
          <div>
            <label className="text-sm font-medium text-gray-700">Style tags</label>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">Optional — feeds the auto-pick scorer.</p>
            <ChipRow
              items={COMMON_STYLE_TAGS}
              selected={metadata.styleTags ?? []}
              onToggle={toggleStyleTag}
            />
          </div>

          {/* Category affinity — which categories this Signature Model is
              best for. When AI Casting is on and the retailer has NOT picked
              a specific Signature Model, the resolver prefers the profile
              whose categories match the product. */}
          <div>
            <label className="text-sm font-medium text-gray-700">Best for categories</label>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">Optional — AI Casting will prefer this model for products in these categories.</p>
            <ChipRow
              items={COMMON_CATEGORIES}
              selected={metadata.categoryAffinity ?? []}
              onToggle={toggleCategory}
            />
          </div>

          {/* Pose mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Posing</label>
            <div className="grid grid-cols-2 gap-2">
              <PoseCard
                active={poseMode === "studio"}
                title="Studio"
                subtitle="Consistent catalogue pose — locked by the reference"
                onClick={() => setPoseMode("studio")}
              />
              <PoseCard
                active={poseMode === "editorial"}
                title="Editorial"
                subtitle="Creative pose — varies with the occasion"
                onClick={() => setPoseMode("editorial")}
              />
            </div>
            <p className="text-xs text-gray-500 flex items-start gap-1.5 mt-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Some appearance fields apply only when the Premium engine
                generates this product; the Economy engine will use its own
                catalogue pose regardless.
              </span>
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              {editingExisting && (
                <Button
                  variant="ghost"
                  onClick={() => remove(editingId!)}
                  className="text-red-600 hover:bg-red-50 gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancel} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </section>
      )}

      {!showForm && profiles.length === 0 && (
        <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
          <Sparkles className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">No Signature Models yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Save a face and appearance you can reuse for every catalogue.
          </p>
          <Button onClick={startNew} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create your first Signature Model
          </Button>
        </section>
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function SignatureCard({
  profile, active, onEdit, onDelete,
}: {
  profile: SignatureModelSummary;
  active: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`shrink-0 w-40 h-52 rounded-2xl border overflow-hidden bg-white group relative transition-all ${
        active
          ? "border-indigo-400 shadow-md ring-2 ring-indigo-100"
          : "border-gray-100 hover:border-indigo-200 hover:shadow-md"
      }`}
    >
      <button onClick={onEdit} className="w-full h-full flex flex-col text-left">
        <div className="relative flex-1 bg-gradient-to-br from-indigo-50 to-purple-50">
          {profile.faceThumbnailUrl && (
            <Image
              src={profile.faceThumbnailUrl}
              alt={profile.faceLabel ?? ""}
              fill
              className="object-cover"
              sizes="160px"
              unoptimized
            />
          )}
        </div>
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-gray-900 truncate">{profile.name}</p>
          <p className="text-xs text-gray-500 truncate">{profile.faceLabel ?? "—"}</p>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-white/90 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 text-gray-500 transition-all"
        aria-label="Delete Signature Model"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FacePickerGroup({
  title, faces, value, onChange,
}: {
  title: string;
  faces: FaceEntry[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">{title}</p>
      <div className="grid grid-cols-6 gap-2">
        {faces.map((face) => (
          <button
            key={face.id}
            onClick={() => onChange(face.id)}
            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
              value === face.id
                ? "border-indigo-500 ring-2 ring-indigo-100"
                : "border-transparent hover:border-gray-200"
            }`}
            title={face.label}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50" />
            <Image
              src={face.thumbnailUrl}
              alt={face.label}
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipRow({
  items, selected, onToggle,
}: {
  items: readonly string[];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  const set = new Set(selected);
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const active = set.has(item);
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              active
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function PoseCard({
  active, title, subtitle, onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-xl border-2 transition-all ${
        active
          ? "border-indigo-500 bg-indigo-50/40"
          : "border-gray-100 hover:border-gray-200"
      }`}
    >
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
    </button>
  );
}

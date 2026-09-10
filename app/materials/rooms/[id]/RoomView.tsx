"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Pencil, Heart, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseJsonSafe } from "@/lib/home-material/client";
import { parseArray } from "@/lib/serialize";
import { calculateSheetsNeeded } from "@/lib/home-material/sheet-calculation";

type Point = { x: number; y: number };

type WallCandidate = {
  polygon: Point[];
  confidence: number;
  label: string | null;
  corners: Point[] | null;
  possiblyTruncated: boolean;
};

type Surface = {
  id: string;
  label: string | null;
  geometryData: string | null;
  measurementSource?: string;
  possiblyTruncated?: boolean;
  widthMeters?: number | null;
  heightMeters?: number | null;
  areaSqm?: number | null;
  dimensionsEstimated?: boolean;
  adjacencyGroupId?: string | null;
};

type Room = {
  id: string;
  imageUrl: string;
  roomType: string;
  surfaces: Surface[];
};

type Swatch = {
  id: string;
  name: string;
  colorName: string | null;
  colorHex: string | null;
  finish: string | null;
  textureAssetUrl?: string | null;
  isCustom?: boolean;
  materialId?: string | null;
  priceInr?: number | null;
  priceIsExact?: boolean;
  costRangeMinInr?: number | null;
  costRangeMaxInr?: number | null;
  // Sheet-size-aware scaling (2026-09-09) — see lib/home-material/sheet-calculation.ts.
  patternType?: string;
  sheetWidthM?: number | null;
  sheetHeightM?: number | null;
  minWidthM?: number | null;
  minHeightM?: number | null;
};

type Visualization = {
  id: string;
  status: string;
  outputImageUrl: string | null;
  errorMessage: string | null;
  mode?: string;
  productId?: string | null;
  perspectiveCorrected?: boolean;
  trueScaleRendered?: boolean;
  adjacencyContinuityApplied?: boolean;
  // "Honest overview" (2026-09-09) — raw Prisma row fields, JSON-string
  // arrays (lib/serialize.ts), parsed client-side by OverviewCard below.
  overviewStatus?: string;
  overviewOpening?: string | null;
  overviewHighlights?: string;
  overviewConsiderations?: string;
  overviewClosing?: string | null;
  overviewAlternativeProductIds?: string;
};

type Requirements = {
  wetArea: boolean;
  budgetTier: "budget" | "mid" | "premium" | "any";
  priority: "durability" | "low_maintenance" | "premium_look" | "any";
  preferredCategory: "paint" | "wallpaper" | "wall_texture" | "wall_panel" | "any";
};

type Recommendation = {
  id: string;
  materialId: string | null;
  score: number;
  confidence: number;
  reasons: string[];
  concerns: string[];
  material: {
    id: string;
    name: string;
    category: string;
    avgCostPerSqftMinInr?: number | null;
    avgCostPerSqftMaxInr?: number | null;
  } | null;
};

/** One half of a combination pick — mirrors lib/home-material/recommendation.ts's MaterialRecommendationResult (ephemeral, never persisted, so no joined HmMaterial cost fields). */
type ComboMaterial = {
  materialId: string;
  slug: string;
  name: string;
  category: string;
  score: number;
  reasons: string[];
  concerns: string[];
};

type SameWallCombination = {
  categories: [string, string];
  materials: [ComboMaterial, ComboMaterial];
  compatibility: "high" | "medium";
  role: string;
  score: number;
  explanation: string;
};

type RoomScheme = {
  featureWall: ComboMaterial;
  surroundingWalls: ComboMaterial;
  explanation: string;
};

const DEFAULT_REQUIREMENTS: Requirements = {
  wetArea: false,
  budgetTier: "any",
  priority: "any",
  preferredCategory: "any",
};

function parsePolygon(geometryData: string | null): Point[] | null {
  if (!geometryData) return null;
  try {
    const g = JSON.parse(geometryData);
    if (Array.isArray(g.points) && g.points.every((p: unknown) => typeof (p as Point)?.x === "number" && typeof (p as Point)?.y === "number")) {
      return g.points;
    }
  } catch {
    // ignore malformed rows rather than crash the page
  }
  return null;
}

function polygonPointsAttr(points: Point[]): string {
  return points.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(" ");
}

/** Visual, scrollable swatch picker — a colour/photo card per swatch, not a text dropdown, so people can actually see what they're choosing. */
function SwatchCarousel({
  swatches,
  selectedId,
  onSelect,
  shortlisted,
  onToggleShortlist,
}: {
  swatches: Swatch[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  shortlisted: Set<string>;
  onToggleShortlist: (id: string) => void;
}) {
  function Card({ sw }: { sw: Swatch }) {
    const selected = sw.id === selectedId;
    const isShortlisted = shortlisted.has(sw.id);
    return (
      <div className="relative shrink-0 w-20 snap-start">
        <button
          type="button"
          onClick={() => onSelect(sw.id)}
          className={`w-full flex flex-col items-center gap-1 rounded-xl p-1.5 border-2 transition-colors ${
            selected ? "border-indigo-500 bg-indigo-50" : "border-transparent hover:bg-gray-50"
          }`}
        >
          {sw.textureAssetUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sw.textureAssetUrl} alt={sw.name} className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
          ) : (
            <div
              className="w-16 h-16 rounded-lg border border-gray-200"
              style={{ backgroundColor: sw.colorHex || "#e5e7eb" }}
            />
          )}
          <span className="text-[11px] text-gray-700 leading-tight text-center line-clamp-2">{sw.name}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleShortlist(sw.id);
          }}
          title={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
          className="absolute top-0.5 right-0.5 rounded-full bg-white/90 p-1 shadow-sm hover:bg-white"
        >
          <Heart className={`h-3.5 w-3.5 ${isShortlisted ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
        </button>
      </div>
    );
  }

  const curated = swatches.filter((sw) => !sw.isCustom);
  const custom = swatches.filter((sw) => sw.isCustom);

  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1">
      {custom.map((sw) => <Card key={sw.id} sw={sw} />)}
      {curated.map((sw) => <Card key={sw.id} sw={sw} />)}
      {swatches.length === 0 && <p className="text-xs text-gray-400 py-4">No swatches yet.</p>}
    </div>
  );
}

/**
 * Cost estimate — brief's "Estimate" step (§16 core journey, §35 cost
 * model), material cost only (no installation/labour, stated explicitly).
 * Shows a real retailer-listed per-sqft price when one exists (exact),
 * else the material category's general indicative range (platform
 * estimate) — never both, so the user isn't shown a false sense of
 * precision. Self-contained: its own area (sqft) input, not shared with
 * the lead form's separate area field.
 */
function CostEstimator({
  minPerSqft,
  maxPerSqft,
  exactPerSqft,
  initialAreaSqft,
}: {
  minPerSqft?: number | null;
  maxPerSqft?: number | null;
  exactPerSqft?: number | null;
  /** Pre-fills the area field from a wall's known real dimensions (see WallDimensionsNotice) — still fully editable, never overwrites something the user already typed. */
  initialAreaSqft?: number | null;
}) {
  const [areaSqft, setAreaSqft] = useState(initialAreaSqft ? String(Math.round(initialAreaSqft)) : "");
  // Adjust state during render (React's recommended pattern for syncing
  // to a prop change without an effect) — fills in the area once the
  // wall's real dimensions become known, but never overwrites something
  // the user already typed.
  const [lastAppliedInitial, setLastAppliedInitial] = useState(initialAreaSqft ?? null);
  if ((initialAreaSqft ?? null) !== lastAppliedInitial) {
    setLastAppliedInitial(initialAreaSqft ?? null);
    if (initialAreaSqft && !areaSqft) setAreaSqft(String(Math.round(initialAreaSqft)));
  }
  const area = parseFloat(areaSqft);
  const hasArea = Number.isFinite(area) && area > 0;

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  if (exactPerSqft == null && (minPerSqft == null || maxPerSqft == null)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
      <input
        type="number"
        min={1}
        placeholder="Area (sqft)"
        value={areaSqft}
        onChange={(e) => setAreaSqft(e.target.value)}
        className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {exactPerSqft != null ? (
        <span>
          ₹{exactPerSqft}/sqft{hasArea && <> · est. total {fmt(exactPerSqft * area)}</>}{" "}
          <span className="text-gray-400">(material only, retailer-listed price)</span>
        </span>
      ) : (
        <span>
          ₹{minPerSqft}–₹{maxPerSqft}/sqft
          {hasArea && (
            <>
              {" "}· est. total {fmt(minPerSqft! * area)}–{fmt(maxPerSqft! * area)}
            </>
          )}{" "}
          <span className="text-gray-400">(material only, platform estimate)</span>
        </span>
      )}
    </div>
  );
}

const FEET_PER_METER = 1 / 0.3048;
const SQM_PER_SQFT = 0.092903; // same conversion factor used app-wide (e.g. HmLead.estimatedAreaSqm)

/**
 * Wall-truncation honesty mitigation (2026-09-09, "never manufacture
 * certainty" applied to wall length, not just shape) — when detection
 * isn't confident the photo captured the wall's full physical extent,
 * this shows a plain warning and an OPTIONAL real-dimension entry (feet,
 * India convention; stored as meters, schema-literal unit — same
 * pattern as HmLead.estimatedAreaSqm). Never blocks anything: a wall
 * with no dimensions set just keeps estimating from the visible photo
 * portion, same as before this existed. Renders nothing for a wall not
 * flagged as possibly truncated.
 */
function WallDimensionsNotice({
  roomId,
  surface,
  onSaved,
}: {
  roomId: string;
  surface: Surface;
  onSaved: (updated: Surface) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [widthFt, setWidthFt] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!surface.possiblyTruncated) return null;

  const hasDimensions = surface.widthMeters != null && surface.heightMeters != null;

  async function handleSave() {
    const w = parseFloat(widthFt);
    const h = parseFloat(heightFt);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
      setError("Enter positive numbers for both width and height.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces/${surface.id}/dimensions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widthMeters: w / FEET_PER_METER, heightMeters: h / FEET_PER_METER }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save dimensions");
        return;
      }
      onSaved(data.surface as Surface);
      setEditing(false);
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (hasDimensions && !editing) {
    const wFt = Math.round((surface.widthMeters ?? 0) * FEET_PER_METER);
    const hFt = Math.round((surface.heightMeters ?? 0) * FEET_PER_METER);
    return (
      <p className="text-xs text-gray-500">
        Wall size: {wFt} ft × {hFt} ft{" "}
        <button type="button" onClick={() => { setWidthFt(String(wFt)); setHeightFt(String(hFt)); setEditing(true); }} className="text-indigo-600 hover:text-indigo-800 underline">
          Edit
        </button>
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
      <p className="text-xs text-amber-800">
        ⚠ This wall may extend beyond what&apos;s captured in the photo — the preview and any area estimate reflect only the visible portion.
      </p>
      {editing ? (
        <>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              placeholder="Width (ft)"
              value={widthFt}
              onChange={(e) => setWidthFt(e.target.value)}
              className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              min={1}
              placeholder="Height (ft)"
              value={heightFt}
              onChange={(e) => setHeightFt(e.target.value)}
              className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button size="sm" onClick={handleSave} loading={saving}>Save</Button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          Know the wall&apos;s real size? Enter it for a more accurate estimate
        </button>
      )}
    </div>
  );
}

/**
 * Blocks ONE preview attempt for a repeat-pattern sheet good when the
 * wall's real size couldn't be determined at all (not user-entered, and
 * the reference-object AI estimate found nothing usable) — per the
 * user's explicit instruction (2026-09-09): a rough size makes a real
 * difference for a repeating pattern's scale and sheet count, so this
 * asks once rather than silently rendering at a guessed scale. Never
 * traps the user: "Continue anyway" re-runs the same preview with
 * skipDimensionCheck, falling back to today's stretch-to-fit rendering.
 */
function NeedsDimensionsPrompt({
  roomId,
  surfaceId,
  message,
  onSaved,
  onContinueAnyway,
  continuing,
}: {
  roomId: string;
  surfaceId: string;
  message: string;
  onSaved: (updated: Surface) => void;
  onContinueAnyway: () => void;
  continuing: boolean;
}) {
  const [widthFt, setWidthFt] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSaveAndPreview() {
    const w = parseFloat(widthFt);
    const h = parseFloat(heightFt);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
      setError("Enter positive numbers for both width and height.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces/${surfaceId}/dimensions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widthMeters: w / FEET_PER_METER, heightMeters: h / FEET_PER_METER }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save dimensions");
        return;
      }
      onSaved(data.surface as Surface);
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
      <p className="text-xs text-amber-800">⚠ {message}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          placeholder="Width (ft)"
          value={widthFt}
          onChange={(e) => setWidthFt(e.target.value)}
          className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="number"
          min={1}
          placeholder="Height (ft)"
          value={heightFt}
          onChange={(e) => setHeightFt(e.target.value)}
          className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button size="sm" onClick={handleSaveAndPreview} loading={saving}>Save &amp; preview</Button>
        <Button size="sm" variant="secondary" onClick={onContinueAnyway} loading={continuing}>Continue anyway</Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/**
 * Marks 2+ walls as physically adjacent for sheet-count purposes
 * (2026-09-09). Adjacency is still only EVER saved by the user clicking
 * "Mark selected as adjacent" below — but as of 2026-09-10 (sub-problem A,
 * built after a dedicated scoping discussion) an optional "Suggest
 * adjacency (AI)" pass can pre-check the boxes for a group it's confident
 * about. Suggest-only, never auto-saves: same "AI proposes, human
 * confirms" pattern as wall-detection candidates and the honest-overview
 * alternative products elsewhere in this domain. Only shown when the same
 * repeat_sheet product is selected on 2+ confirmed walls in one room.
 */
function AdjacencyMarker({
  roomId,
  surfaces,
  productName,
  onUpdated,
}: {
  roomId: string;
  surfaces: Surface[];
  productName: string;
  onUpdated: (updated: Surface[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [suggestedGroups, setSuggestedGroups] = useState<{ wallIds: string[]; confidence: number; reason: string }[] | null>(null);
  const [suggestNotes, setSuggestNotes] = useState<string | null>(null);

  async function handleMark() {
    if (checked.size < 2) {
      setError("Select at least 2 walls that are physically adjacent.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces/adjacency`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surfaceIds: [...checked] }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      onUpdated(data.surfaces as Surface[]);
      setChecked(new Set());
      setSuggestedGroups(null);
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSuggest() {
    setSuggestError("");
    setSuggesting(true);
    setSuggestedGroups(null);
    setSuggestNotes(null);
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces/adjacency/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surfaceIds: surfaces.map((s) => s.id) }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setSuggestError(typeof data.error === "string" ? data.error : "Could not get a suggestion");
        return;
      }
      setSuggestedGroups(Array.isArray(data.groups) ? data.groups : []);
      setSuggestNotes(typeof data.notes === "string" ? data.notes : null);
    } catch (err) {
      setSuggestError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSuggesting(false);
    }
  }

  const groups = new Map<string, Surface[]>();
  for (const s of surfaces) {
    if (!s.adjacencyGroupId) continue;
    const list = groups.get(s.adjacencyGroupId) ?? [];
    list.push(s);
    groups.set(s.adjacencyGroupId, list);
  }

  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-2">
      <p className="text-xs font-medium text-gray-700">Multiple walls use {productName} — are any physically adjacent (share a corner)?</p>
      <p className="text-[11px] text-gray-500">Marking adjacent walls combines them into one continuous run for sheet counting — more accurate, less wasteful.</p>
      {[...groups.entries()].map(([gid, list]) => (
        <p key={gid} className="text-xs text-emerald-700">✓ Adjacent: {list.map((s) => s.label || "Wall").join(", ")}</p>
      ))}
      <div className="flex flex-wrap gap-3">
        {surfaces.map((s) => (
          <label key={s.id} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={checked.has(s.id)}
              onChange={(e) =>
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  return next;
                })
              }
            />
            {s.label || "Wall"}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={handleSuggest} loading={suggesting}>Suggest adjacency (AI)</Button>
        <Button size="sm" onClick={handleMark} loading={saving}>Mark selected as adjacent</Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {suggestError && <p className="text-xs text-red-500">{suggestError}</p>}
      {suggestedGroups && suggestedGroups.length === 0 && (
        <p className="text-[11px] text-gray-500">AI didn&apos;t find confident evidence of adjacency{suggestNotes ? ` (${suggestNotes})` : ""} — you can still mark it manually if you know they&apos;re physically adjacent.</p>
      )}
      {suggestedGroups && suggestedGroups.length > 0 && (
        <div className="space-y-1">
          {suggestedGroups.map((g, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-indigo-50 px-2 py-1.5">
              <p className="text-[11px] text-indigo-800">
                AI suggests <strong>{g.wallIds.map((id) => surfaces.find((s) => s.id === id)?.label || "Wall").join(" + ")}</strong> are adjacent ({Math.round(g.confidence * 100)}% confidence) — {g.reason}
              </p>
              <button type="button" className="shrink-0 text-[11px] font-medium text-indigo-700 underline" onClick={() => setChecked(new Set(g.wallIds))}>
                Select these
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Request a quote" lead capture (brief §17) — tied to either a specific
 * product or just a material category (recommendations are material-level,
 * not SKU-level, so productId won't always apply). Self-contained: manages
 * its own open/closed + form + submit state rather than living in
 * RoomView's already-large state surface.
 *
 * Resolves server-side to whichever HmRetailer exists — as of 2026-09-08
 * that's exactly one deliberately-labeled placeholder
 * (scripts/seed-retailers.ts), not a real business. The confirmation
 * copy below always echoes the real retailer name/isVerified flag from
 * the response rather than assuming — never silently implies a real
 * business received the request.
 */
function LeadCaptureButton({ productId, materialCategory }: { productId?: string; materialCategory?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [areaSqft, setAreaSqft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ name: string; isVerified: boolean } | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const parsedArea = parseFloat(areaSqft);
      const res = await fetch(`/api/home-material/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          materialCategory,
          contactName: name,
          contactPhone: phone,
          contactEmail: email || undefined,
          message: message || undefined,
          areaSqft: Number.isFinite(parsedArea) && parsedArea > 0 ? parsedArea : undefined,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not submit request");
        return;
      }
      setResult(data.retailer as { name: string; isVerified: boolean });
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <p className="text-xs text-emerald-700 mt-2">
        ✓ Request saved. Note: {result.name} is placeholder demo data, not a real business yet — this won&apos;t
        reach an actual retailer until real partners are onboarded.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 mt-2">
        Request a quote
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-amber-700">⚠ Demo mode — no real retailer will receive this yet.</p>
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <input
        type="tel"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <input
        type="number"
        min={1}
        placeholder="Approximate area in sqft (optional)"
        value={areaSqft}
        onChange={(e) => setAreaSqft(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <textarea
        placeholder="Message (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="flex-1" onClick={handleSubmit} loading={submitting}>Submit</Button>
      </div>
    </div>
  );
}

/**
 * Mandatory "honest overview" (2026-09-09, "start with G + lightweight E").
 * A soft, always-encouraging read of the ACTUAL generated result — never a
 * bare score, never negative wording (enforced server-side in
 * lib/home-material/overview.ts's tone guard) — plus deterministically
 * chosen alternative swatches, always shown regardless of how well the
 * primary result scored. Renders nothing when the overview pass failed or
 * hasn't completed — a soft feature whose absence should never look like
 * an error next to an otherwise-successful preview.
 */
function OverviewCard({
  vis,
  swatches,
  onPreviewAlternative,
}: {
  vis: Visualization;
  swatches: Swatch[];
  onPreviewAlternative: (productId: string) => void;
}) {
  if (vis.overviewStatus !== "completed" || !vis.overviewOpening) return null;

  const highlights = parseArray(vis.overviewHighlights);
  const considerations = parseArray(vis.overviewConsiderations);
  const alternatives = parseArray(vis.overviewAlternativeProductIds)
    .map((id) => swatches.find((sw) => sw.id === id))
    .filter((sw): sw is Swatch => Boolean(sw));

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <p className="text-sm text-gray-800">{vis.overviewOpening}</p>
      {highlights.length > 0 && (
        <ul className="space-y-0.5">
          {highlights.map((h) => (
            <li key={h} className="text-xs text-emerald-700">✓ {h}</li>
          ))}
        </ul>
      )}
      {considerations.length > 0 && (
        <ul className="space-y-0.5">
          {considerations.map((c) => (
            <li key={c} className="text-xs text-amber-700">✦ {c}</li>
          ))}
        </ul>
      )}
      {vis.overviewClosing && <p className="text-xs text-gray-600 italic">{vis.overviewClosing}</p>}
      {alternatives.length > 0 && (
        <div className="pt-1.5 border-t border-indigo-100">
          <p className="text-[11px] text-gray-500 mb-1">Worth a look too:</p>
          <div className="flex gap-2">
            {alternatives.map((sw) => (
              <button
                key={sw.id}
                type="button"
                onClick={() => onPreviewAlternative(sw.id)}
                className="shrink-0 flex flex-col items-center gap-1 w-14"
              >
                {sw.textureAssetUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sw.textureAssetUrl} alt={sw.name} className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                ) : (
                  <div className="w-12 h-12 rounded-lg border border-gray-200" style={{ backgroundColor: sw.colorHex || "#e5e7eb" }} />
                )}
                <span className="text-[10px] text-gray-600 text-center line-clamp-2">{sw.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AI wall detection (fast-lane pivot, 2026-09-07) returns a POLYGON outline
 * — scoped to a straight-on, facing-the-wall photo — shown as an editable
 * draft (draggable vertices) before the user confirms it. Manual
 * click-to-place drawing remains available as a fallback. An already-saved
 * wall can be re-shaped too (2026-09-07, second round) via the same
 * draft/adjust UI, saved with PATCH instead of POST.
 */
export function RoomView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const imageRef = useRef<HTMLDivElement>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reuploading, setReuploading] = useState(false);
  const [reuploadError, setReuploadError] = useState("");

  // Draft polygon being created/adjusted — from AI detection, manual
  // clicks, or re-shaping an already-saved surface (editingSurfaceId set).
  const [draftPoints, setDraftPoints] = useState<Point[] | null>(null);
  const [draftOrigin, setDraftOrigin] = useState<"ai" | "manual" | null>(null);
  const [draftConfidence, setDraftConfidence] = useState<number | null>(null);
  // Sub-problem B (2026-09-09): the AI's perspective quad, carried along
  // only until the user manually adjusts the outline — see
  // handleVertexPointerDown, which clears this the moment a vertex is
  // dragged, since an edited outline makes the original quad suspect too.
  const [draftCorners, setDraftCorners] = useState<Point[] | null>(null);
  // Wall-truncation honesty (2026-09-09) — the AI's judgment on whether
  // this wall's full extent was captured. Unlike draftCorners, adjusting
  // the outline's shape doesn't make this stale (it's about the wall's
  // real-world extent, not the traced geometry), so it's NOT cleared on
  // vertex drag — only reset alongside everything else in resetDraft.
  const [draftPossiblyTruncated, setDraftPossiblyTruncated] = useState(false);
  const [editingSurfaceId, setEditingSurfaceId] = useState<string | null>(null);
  const [manualDrawing, setManualDrawing] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState("");
  // Lightweight multi-wall (2026-09-09): every independent wall candidate
  // from the last detection call, still pending a pick. No perspective-
  // correction or cross-wall continuity guarantee — see
  // lib/home-material/wall-detection.ts.
  const [wallCandidates, setWallCandidates] = useState<WallCandidate[]>([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState<number | null>(null);

  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [selectedSwatch, setSelectedSwatch] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [visualizations, setVisualizations] = useState<Record<string, Visualization>>({});
  const [previewError, setPreviewError] = useState<Record<string, string>>({});
  // Repeat-pattern sheet goods need the wall's real size to render at
  // true scale (2026-09-09) — set when the API blocks a preview for this
  // reason, cleared once resolved (dimensions entered, or "continue
  // anyway"). See NeedsDimensionsPrompt below.
  const [needsDimensionsFor, setNeedsDimensionsFor] = useState<Record<string, { productId: string; message: string }>>({});

  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Mandatory classification (2026-09-09) — every upload must say which
  // it is; "" means not yet chosen, forcing an explicit pick rather than
  // silently defaulting. See lib/home-material/sheet-calculation.ts.
  const [uploadPatternType, setUploadPatternType] = useState<"" | "customizable" | "repeat_sheet">("");
  const [uploadSheetWidthFt, setUploadSheetWidthFt] = useState("");
  const [uploadSheetHeightFt, setUploadSheetHeightFt] = useState("");

  const [showHelpMeChoose, setShowHelpMeChoose] = useState<Record<string, boolean>>({});
  const [requirements, setRequirements] = useState<Record<string, Requirements>>({});
  const [recommending, setRecommending] = useState<Record<string, boolean>>({});
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation[]>>({});
  const [recommendError, setRecommendError] = useState<Record<string, string>>({});

  // Sub-problem F, combination recommendations (2026-09-10) — same-wall
  // layered combos (per wall) and a cross-wall room scheme (per room),
  // both ephemeral (see lib/home-material/combination-recommendation.ts).
  const [combining, setCombining] = useState<Record<string, boolean>>({});
  const [combinations, setCombinations] = useState<Record<string, SameWallCombination[]>>({});
  const [combineError, setCombineError] = useState<Record<string, string>>({});
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [schemeResult, setSchemeResult] = useState<RoomScheme | null>(null);
  const [schemeError, setSchemeError] = useState("");

  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());

  function loadSwatches() {
    fetch(`/api/home-material/products`)
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => setSwatches(data.products ?? []))
      .catch(() => setSwatches([]));
  }

  function loadShortlist() {
    fetch(`/api/home-material/shortlist`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setShortlisted(new Set((data.items ?? []).map((i: { product: { id: string } }) => i.product.id))))
      .catch(() => {});
  }

  async function handleToggleShortlist(productId: string) {
    const wasShortlisted = shortlisted.has(productId);
    // Optimistic update — this is a lightweight toggle, not worth a loading spinner.
    setShortlisted((prev) => {
      const next = new Set(prev);
      if (wasShortlisted) next.delete(productId);
      else next.add(productId);
      return next;
    });
    try {
      if (wasShortlisted) {
        await fetch(`/api/home-material/shortlist/${productId}`, { method: "DELETE" });
      } else {
        await fetch(`/api/home-material/shortlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
      }
    } catch {
      // Revert on failure — better than silently claiming it worked.
      setShortlisted((prev) => {
        const next = new Set(prev);
        if (wasShortlisted) next.add(productId);
        else next.delete(productId);
        return next;
      });
    }
  }

  useEffect(() => {
    fetch(`/api/home-material/rooms/${roomId}`)
      .then(async (res) => {
        if (res.status === 401) {
          router.push(`/materials/login?returnTo=${encodeURIComponent(`/materials/rooms/${roomId}`)}`);
          return null;
        }
        if (!res.ok) throw new Error("Room not found");
        return res.json();
      })
      .then((data) => data && setRoom(data.room))
      .catch(() => setError("Could not load this room."))
      .finally(() => setLoading(false));

    loadSwatches();
    loadShortlist();
  }, [roomId, router]);

  function resetDraft() {
    setDraftPoints(null);
    setDraftOrigin(null);
    setDraftConfidence(null);
    setDraftCorners(null);
    setDraftPossiblyTruncated(false);
    setEditingSurfaceId(null);
    setManualDrawing(false);
    setActiveCandidateIndex(null);
    setLabel("");
  }

  function enterDraftFromCandidate(c: WallCandidate) {
    setDraftPoints(c.polygon);
    setDraftOrigin("ai");
    setDraftConfidence(c.confidence);
    setDraftCorners(c.corners);
    setDraftPossiblyTruncated(c.possiblyTruncated);
    setLabel(c.label ?? "");
    setEditingSurfaceId(null);
    setManualDrawing(false);
  }

  /** Picking one of several detected walls to adjust/confirm — the rest stay pickable (discarding the draft, e.g. Cancel, puts this one back too since it's never removed from wallCandidates until actually confirmed). */
  function selectCandidate(index: number) {
    const c = wallCandidates[index];
    if (!c) return;
    enterDraftFromCandidate(c);
    setActiveCandidateIndex(index);
    setError("");
  }

  async function handleDetectWall() {
    setDetectError("");
    setDetecting(true);
    resetDraft();
    setWallCandidates([]);
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/detect-wall`, { method: "POST" });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setDetectError(typeof data.error === "string" ? data.error : "Could not detect a wall in this photo. Try selecting it manually below.");
        setManualDrawing(true);
        return;
      }
      const walls = (data.walls as WallCandidate[]) ?? [];
      if (walls.length <= 1) {
        // The common single-wall case skips the picker entirely — go
        // straight into the familiar adjust-and-confirm draft flow.
        if (walls[0]) enterDraftFromCandidate(walls[0]);
      } else {
        setWallCandidates(walls);
      }
    } catch (err) {
      setDetectError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
      setManualDrawing(true);
    } finally {
      setDetecting(false);
    }
  }

  function startManualDrawing() {
    resetDraft();
    setManualDrawing(true);
    setDraftPoints([]);
  }

  function startEditSurface(s: Surface) {
    const pts = parsePolygon(s.geometryData);
    if (!pts) return;
    setDraftPoints(pts);
    setDraftOrigin("manual");
    setDraftConfidence(null);
    setEditingSurfaceId(s.id);
    setManualDrawing(false);
    setLabel(s.label ?? "");
    setError("");
  }

  function fractionalPoint(e: { clientX: number; clientY: number }): Point {
    const rect = imageRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function handleImageClick(e: React.MouseEvent) {
    if (!manualDrawing) return;
    const p = fractionalPoint(e);
    setDraftPoints((pts) => [...(pts ?? []), p]);
  }

  function finishManualShape() {
    if (!draftPoints || draftPoints.length < 3) {
      setError("Place at least 3 points to trace the wall outline.");
      return;
    }
    setError("");
    setManualDrawing(false);
    setDraftOrigin("manual");
  }

  function handleVertexPointerDown(index: number, e: React.PointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDraggingIndex(index);
    // Once the user starts correcting the AI's outline by hand, the AI's
    // perspective quad becomes suspect too (it was computed from the same
    // detection pass) — drop it rather than risk warping onto a
    // now-stale quad. Falls back to the standard flat-mask/AI-generation
    // path, same as if no quad had ever been detected.
    setDraftCorners(null);
  }

  function handleContainerPointerMove(e: React.PointerEvent) {
    if (draggingIndex === null || !draftPoints) return;
    const p = fractionalPoint(e);
    setDraftPoints(draftPoints.map((pt, i) => (i === draggingIndex ? p : pt)));
  }

  function handleContainerPointerUp() {
    setDraggingIndex(null);
  }

  async function handleConfirmSurface() {
    if (!draftPoints || draftPoints.length < 3) return;
    setError("");
    setSaving(true);
    const consumedCandidateIndex = activeCandidateIndex;
    try {
      if (editingSurfaceId) {
        const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces/${editingSurfaceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: draftPoints, label: label || null }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Could not save this shape");
          return;
        }
        setRoom((r) => (r ? { ...r, surfaces: r.surfaces.map((s) => (s.id === editingSurfaceId ? (data.surface as Surface) : s)) } : r));
      } else {
        const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: draftPoints,
            label: label || undefined,
            measurementSource: draftOrigin === "ai" ? "ai_estimated" : "user_confirmed",
            measurementConfidence: draftOrigin === "ai" ? draftConfidence : undefined,
            corners: draftCorners ?? undefined,
            possiblyTruncated: draftPossiblyTruncated,
          }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Could not save this wall selection");
          return;
        }
        setRoom((r) => (r ? { ...r, surfaces: [...r.surfaces, data.surface as Surface] } : r));
        if (consumedCandidateIndex !== null) {
          setWallCandidates((cands) => cands.filter((_, i) => i !== consumedCandidateIndex));
        }
      }
      resetDraft();
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReupload(file: File) {
    setReuploadError("");
    setReuploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/home-material/rooms/${roomId}`, { method: "PATCH", body: formData });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setReuploadError(typeof data.error === "string" ? data.error : "Reupload failed");
        return;
      }
      setRoom(data.room as Room);
      resetDraft();
      setWallCandidates([]);
      setVisualizations({});
      setSelectedSwatch({});
      setPreviewError({});
    } catch (err) {
      setReuploadError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setReuploading(false);
      if (reuploadInputRef.current) reuploadInputRef.current.value = "";
    }
  }

  async function handleGeneratePreview(surfaceId: string, productIdOverride?: string, skipDimensionCheck?: boolean) {
    // productIdOverride lets a caller that just called setSelectedSwatch
    // (e.g. "Preview this" / an overview's alternative swatch) pass the
    // new id directly, since selectedSwatch here is still the state from
    // this render — the setSelectedSwatch update hasn't landed yet.
    const productId = productIdOverride ?? selectedSwatch[surfaceId];
    if (!productId) {
      setPreviewError((p) => ({ ...p, [surfaceId]: "Pick a swatch first." }));
      return;
    }
    setPreviewError((p) => ({ ...p, [surfaceId]: "" }));
    setNeedsDimensionsFor((m) => {
      const next = { ...m };
      delete next[surfaceId];
      return next;
    });
    setGenerating((g) => ({ ...g, [surfaceId]: true }));
    try {
      const res = await fetch(`/api/home-material/visualizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surfaceId, productId, skipDimensionCheck: skipDimensionCheck || undefined }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        if (data.needsDimensions) {
          setNeedsDimensionsFor((m) => ({
            ...m,
            [surfaceId]: { productId, message: typeof data.error === "string" ? data.error : "Enter the wall's real size for an accurate preview." },
          }));
          return;
        }
        setPreviewError((p) => ({ ...p, [surfaceId]: typeof data.error === "string" ? data.error : "Preview failed" }));
        if (data.visualization) setVisualizations((v) => ({ ...v, [surfaceId]: data.visualization as Visualization }));
        return;
      }
      setVisualizations((v) => ({ ...v, [surfaceId]: data.visualization as Visualization }));
    } catch (err) {
      setPreviewError((p) => ({ ...p, [surfaceId]: `Something went wrong: ${err instanceof Error ? err.message : String(err)}` }));
    } finally {
      setGenerating((g) => ({ ...g, [surfaceId]: false }));
    }
  }

  function getRequirements(surfaceId: string): Requirements {
    return requirements[surfaceId] ?? DEFAULT_REQUIREMENTS;
  }

  function updateRequirements(surfaceId: string, patch: Partial<Requirements>) {
    setRequirements((r) => ({ ...r, [surfaceId]: { ...getRequirements(surfaceId), ...patch } }));
  }

  async function handleGetRecommendations(surfaceId: string) {
    setRecommendError((p) => ({ ...p, [surfaceId]: "" }));
    setRecommending((g) => ({ ...g, [surfaceId]: true }));
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces/${surfaceId}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getRequirements(surfaceId)),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setRecommendError((p) => ({ ...p, [surfaceId]: typeof data.error === "string" ? data.error : "Could not get recommendations" }));
        return;
      }
      setRecommendations((r) => ({ ...r, [surfaceId]: (data.recommendations as Recommendation[]) ?? [] }));
    } catch (err) {
      setRecommendError((p) => ({ ...p, [surfaceId]: `Something went wrong: ${err instanceof Error ? err.message : String(err)}` }));
    } finally {
      setRecommending((g) => ({ ...g, [surfaceId]: false }));
    }
  }

  async function handleGetCombinations(surfaceId: string) {
    setCombineError((p) => ({ ...p, [surfaceId]: "" }));
    setCombining((g) => ({ ...g, [surfaceId]: true }));
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/surfaces/${surfaceId}/recommend-combinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getRequirements(surfaceId)),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setCombineError((p) => ({ ...p, [surfaceId]: typeof data.error === "string" ? data.error : "Could not get combination ideas" }));
        return;
      }
      setCombinations((c) => ({ ...c, [surfaceId]: (data.combinations as SameWallCombination[]) ?? [] }));
    } catch (err) {
      setCombineError((p) => ({ ...p, [surfaceId]: `Something went wrong: ${err instanceof Error ? err.message : String(err)}` }));
    } finally {
      setCombining((g) => ({ ...g, [surfaceId]: false }));
    }
  }

  async function handleGetRoomScheme() {
    setSchemeError("");
    setSchemeLoading(true);
    try {
      const res = await fetch(`/api/home-material/rooms/${roomId}/recommend-scheme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wetArea: false, budgetTier: "any", priority: "any", preferredCategory: "any" }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setSchemeError(typeof data.error === "string" ? data.error : "Could not get a room scheme");
        return;
      }
      setSchemeResult(data.scheme as RoomScheme);
    } catch (err) {
      setSchemeError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSchemeLoading(false);
    }
  }

  /** A demo/custom swatch that's actually of the recommended material, if one exists — lets "Preview" shortcut straight into the existing visualization flow instead of just describing the material. */
  function findSwatchForMaterial(materialId: string | null): Swatch | undefined {
    if (!materialId) return undefined;
    return swatches.find((sw) => sw.materialId === materialId);
  }

  async function handleUploadSwatch() {
    if (!uploadFile) {
      setUploadError("Choose a photo first.");
      return;
    }
    if (!uploadPatternType) {
      setUploadError("Choose whether this is a customizable design or a repeating pattern.");
      return;
    }
    let sheetWidthM: number | null = null;
    let sheetHeightM: number | null = null;
    if (uploadPatternType === "repeat_sheet") {
      const wFt = parseFloat(uploadSheetWidthFt);
      const hFt = parseFloat(uploadSheetHeightFt);
      if (!Number.isFinite(wFt) || wFt <= 0 || !Number.isFinite(hFt) || hFt <= 0) {
        setUploadError("A repeating pattern needs its real sheet width and height (in feet).");
        return;
      }
      sheetWidthM = wFt / FEET_PER_METER;
      sheetHeightM = hFt / FEET_PER_METER;
    }
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadName) formData.append("name", uploadName);
      formData.append("patternType", uploadPatternType);
      if (sheetWidthM != null) formData.append("sheetWidthM", String(sheetWidthM));
      if (sheetHeightM != null) formData.append("sheetHeightM", String(sheetHeightM));
      const res = await fetch(`/api/home-material/products/upload`, { method: "POST", body: formData });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setUploadError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      setUploadFile(null);
      setUploadName("");
      setUploadPatternType("");
      setUploadSheetWidthFt("");
      setUploadSheetHeightFt("");
      loadSwatches();
    } catch (err) {
      setUploadError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto py-16 px-6 text-sm text-gray-500">Loading…</div>;
  if (error && !room) return <div className="max-w-2xl mx-auto py-16 px-6 text-sm text-red-500">{error}</div>;
  if (!room) return null;

  const hasSurfaces = room.surfaces.length > 0;
  const hasDraft = draftPoints !== null;
  const isAdjustingDraft = hasDraft && !manualDrawing;
  const visibleSurfaces = room.surfaces.filter((s) => s.id !== editingSurfaceId);

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/materials/upload" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/materials/shortlist" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <Scale className="h-4 w-4" /> Compare{shortlisted.size > 0 ? ` (${shortlisted.size})` : ""}
          </Link>
        <div>
          <input
            ref={reuploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (hasSurfaces && !window.confirm("Reuploading will clear the walls you've already selected on this photo. Continue?")) {
                if (reuploadInputRef.current) reuploadInputRef.current.value = "";
                return;
              }
              handleReupload(f);
            }}
          />
          <button
            type="button"
            onClick={() => reuploadInputRef.current?.click()}
            disabled={reuploading}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> {reuploading ? "Uploading…" : "Reupload photo"}
          </button>
        </div>
        </div>
      </div>
      {reuploadError && <p className="text-sm text-red-500">{reuploadError}</p>}

      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {isAdjustingDraft && editingSurfaceId
            ? "Adjust the shape"
            : isAdjustingDraft
            ? "Adjust the outline"
            : manualDrawing
            ? "Trace the wall"
            : wallCandidates.length > 0
            ? `Found ${wallCandidates.length} walls`
            : hasSurfaces
            ? "Wall detected"
            : "Find the wall"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isAdjustingDraft
            ? "Drag any corner to match the wall precisely, then confirm."
            : manualDrawing
            ? "Click around the wall's edges to trace its outline, then finish."
            : wallCandidates.length > 0
            ? "Tap a highlighted wall below to adjust and confirm it — you can come back for the others after."
            : hasSurfaces
            ? "Pick a swatch below to preview it on this wall."
            : "For best results, stand roughly facing the wall(s). We'll detect their outlines automatically."}
        </p>
      </div>

      <div
        ref={imageRef}
        onClick={handleImageClick}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        // The card's ROUNDED corners clip whatever sits right at the
        // image's own corners — including a draggable vertex placed
        // there, exactly where a real wall corner often is. Squared off
        // (rounding only, overflow-hidden stays — it just clips a plain
        // rectangle now, not a curve) during any active editing so
        // nothing near a corner is clipped or hard to grab; rounded again
        // once idle, for the same look elsewhere.
        className={`relative w-full overflow-hidden border border-gray-200 select-none touch-none ${
          isAdjustingDraft || manualDrawing ? "rounded-none" : "rounded-2xl"
        } ${manualDrawing ? "cursor-crosshair" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={room.imageUrl} alt="Room" className="w-full h-auto block pointer-events-none" draggable={false} />

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {visibleSurfaces.map((s) => {
            const pts = parsePolygon(s.geometryData);
            if (!pts) return null;
            const isAiDetected = s.measurementSource === "ai_estimated";
            return (
              <polygon
                key={s.id}
                points={polygonPointsAttr(pts)}
                fill={isAiDetected ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.15)"}
                stroke={isAiDetected ? "#6366f1" : "#10b981"}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {wallCandidates.map((c, i) => {
            const cx = c.polygon.reduce((sum, p) => sum + p.x, 0) / c.polygon.length;
            const cy = c.polygon.reduce((sum, p) => sum + p.y, 0) / c.polygon.length;
            return (
              <g key={`candidate-${i}`} className="cursor-pointer" onClick={() => selectCandidate(i)}>
                <polygon
                  points={polygonPointsAttr(c.polygon)}
                  fill="rgba(234,179,8,0.18)"
                  stroke="#eab308"
                  strokeWidth={0.5}
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={cx * 100} cy={cy * 100} r={3.2} fill="#eab308" vectorEffect="non-scaling-stroke" />
                <text
                  x={cx * 100}
                  y={cy * 100}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={3.5}
                  fill="#ffffff"
                  style={{ pointerEvents: "none" }}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}

          {draftPoints && draftPoints.length > 0 && (
            <polygon
              points={polygonPointsAttr(draftPoints)}
              fill="rgba(99,102,241,0.15)"
              stroke="#6366f1"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {isAdjustingDraft &&
            draftPoints!.map((p, i) => (
              <circle
                key={i}
                cx={p.x * 100}
                cy={p.y * 100}
                r={1.4}
                fill="#ffffff"
                stroke="#6366f1"
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
                className="cursor-move"
                onPointerDown={(e) => handleVertexPointerDown(i, e)}
              />
            ))}
          {manualDrawing &&
            draftPoints?.map((p, i) => (
              <circle key={i} cx={p.x * 100} cy={p.y * 100} r={1} fill="#6366f1" vectorEffect="non-scaling-stroke" />
            ))}
        </svg>
      </div>

      {!hasDraft && !manualDrawing && wallCandidates.length === 0 && (
        <Button className="w-full" size="lg" variant={hasSurfaces ? "secondary" : "default"} onClick={handleDetectWall} loading={detecting}>
          {hasSurfaces ? "Detect another wall" : "Detect wall automatically"}
        </Button>
      )}
      {detectError && <p className="text-sm text-red-500">{detectError}</p>}

      {wallCandidates.length > 0 && !hasDraft && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {wallCandidates.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectCandidate(i)}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">{i + 1}</span>
                {c.label || `Wall ${i + 1}`} · {Math.round(c.confidence * 100)}%
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setWallCandidates([])}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {!hasDraft && !manualDrawing && (
        <button
          type="button"
          onClick={startManualDrawing}
          className="text-xs text-gray-400 hover:text-gray-600 underline w-full text-center"
        >
          {hasSurfaces ? "Add another wall manually" : "Or trace the wall manually"}
        </button>
      )}

      {manualDrawing && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="flex-1" onClick={resetDraft}>Cancel</Button>
          <Button className="flex-1" onClick={finishManualShape} disabled={(draftPoints?.length ?? 0) < 3}>
            Finish shape ({draftPoints?.length ?? 0} point{draftPoints?.length === 1 ? "" : "s"})
          </Button>
        </div>
      )}

      {isAdjustingDraft && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Label (optional, e.g. accent wall)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="flex-1" onClick={resetDraft}>
              {editingSurfaceId ? "Cancel" : "Discard"}
            </Button>
            <Button className="flex-1" onClick={handleConfirmSurface} loading={saving}>
              {editingSurfaceId ? "Save shape" : "Confirm wall"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {room.surfaces.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-semibold text-gray-900">Preview a material</h2>
          {room.surfaces.map((s) => {
            const vis = visualizations[s.id];
            const isBeingEdited = s.id === editingSurfaceId;
            return (
              <div key={s.id} className={`rounded-2xl border p-4 space-y-3 ${isBeingEdited ? "border-indigo-300 bg-indigo-50/30" : "border-gray-200"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">{s.label || "Wall"}</p>
                  <button
                    type="button"
                    onClick={() => (isBeingEdited ? resetDraft() : startEditSurface(s))}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                  >
                    <Pencil className="h-3 w-3" /> {isBeingEdited ? "Editing…" : "Edit shape"}
                  </button>
                </div>
                <WallDimensionsNotice
                  roomId={room.id}
                  surface={s}
                  onSaved={(updated) =>
                    setRoom((r) => (r ? { ...r, surfaces: r.surfaces.map((x) => (x.id === updated.id ? updated : x)) } : r))
                  }
                />
                <SwatchCarousel
                  swatches={swatches}
                  selectedId={selectedSwatch[s.id]}
                  onSelect={(id) => setSelectedSwatch((sel) => ({ ...sel, [s.id]: id }))}
                  shortlisted={shortlisted}
                  onToggleShortlist={handleToggleShortlist}
                />
                {(() => {
                  const selected = swatches.find((sw) => sw.id === selectedSwatch[s.id]);
                  if (!selected) return null;
                  // Sheet-count-aware quote (2026-09-09) — only meaningful
                  // for a real repeat-pattern sheet good once the wall's
                  // real size is known; combines every OTHER confirmed
                  // wall using this SAME product too (adjacency-aware —
                  // see lib/home-material/sheet-calculation.ts).
                  const sheetInfo =
                    selected.patternType === "repeat_sheet" && selected.sheetWidthM && selected.sheetHeightM
                      ? (() => {
                          const wallsUsingThisProduct = room.surfaces
                            .filter((sur) => selectedSwatch[sur.id] === selected.id && sur.widthMeters != null && sur.heightMeters != null)
                            .map((sur) => ({
                              id: sur.id,
                              widthM: sur.widthMeters as number,
                              heightM: sur.heightMeters as number,
                              adjacencyGroupId: sur.adjacencyGroupId ?? null,
                            }));
                          if (wallsUsingThisProduct.length === 0) return null;
                          return calculateSheetsNeeded(wallsUsingThisProduct, { widthM: selected.sheetWidthM as number, heightM: selected.sheetHeightM as number });
                        })()
                      : null;
                  return (
                    <>
                      <CostEstimator
                        minPerSqft={selected.costRangeMinInr}
                        maxPerSqft={selected.costRangeMaxInr}
                        exactPerSqft={selected.priceIsExact ? selected.priceInr : null}
                        initialAreaSqft={s.areaSqm != null ? s.areaSqm / SQM_PER_SQFT : null}
                      />
                      {sheetInfo && (
                        <p className="text-xs text-gray-500">
                          Sheets needed: <span className="font-medium text-gray-700">{sheetInfo.totalSheets}</span>{" "}
                          ({selected.sheetWidthM}m × {selected.sheetHeightM}m each
                          {sheetInfo.groups.length > 1 || sheetInfo.groups.some((g) => g.wallIds.length > 1)
                            ? `, across ${room.surfaces.filter((sur) => selectedSwatch[sur.id] === selected.id).length} walls using this pattern`
                            : ""}
                          )
                        </p>
                      )}
                    </>
                  );
                })()}
                {needsDimensionsFor[s.id] ? (
                  <NeedsDimensionsPrompt
                    roomId={room.id}
                    surfaceId={s.id}
                    message={needsDimensionsFor[s.id].message}
                    continuing={generating[s.id] ?? false}
                    onSaved={(updated) => {
                      setRoom((r) => (r ? { ...r, surfaces: r.surfaces.map((x) => (x.id === updated.id ? updated : x)) } : r));
                      handleGeneratePreview(s.id, needsDimensionsFor[s.id].productId);
                    }}
                    onContinueAnyway={() => handleGeneratePreview(s.id, needsDimensionsFor[s.id].productId, true)}
                  />
                ) : (
                  <Button className="w-full" onClick={() => handleGeneratePreview(s.id)} loading={generating[s.id]}>
                    Preview
                  </Button>
                )}
                {previewError[s.id] && <p className="text-sm text-red-500">{previewError[s.id]}</p>}
                {vis?.status === "completed" && vis.outputImageUrl && (
                  <div className="space-y-1.5">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                        vis.mode === "product_accurate" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {vis.mode === "product_accurate" ? "Product-accurate — from your uploaded photo" : "Quick preview — AI interpretation"}
                    </span>
                    {vis.perspectiveCorrected && (
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ml-1.5"
                        title="This wall was viewed at an angle — the material was mapped onto its real perspective using its exact geometry, not an AI guess."
                      >
                        Perspective-corrected
                      </span>
                    )}
                    {vis.trueScaleRendered && (
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 ml-1.5"
                        title="This pattern was rendered at its real physical size and tiled across the wall, not stretched to fit."
                      >
                        True-scale pattern
                      </span>
                    )}
                    {vis.adjacencyContinuityApplied && (
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 ml-1.5"
                        title="This wall is marked adjacent to another wall using the same pattern — the tiling continues in phase from that wall instead of restarting."
                      >
                        Continues from adjacent wall
                      </span>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={vis.outputImageUrl} alt="Preview" className="w-full rounded-xl border border-gray-200" />
                    <OverviewCard
                      vis={vis}
                      swatches={swatches}
                      onPreviewAlternative={(productId) => {
                        setSelectedSwatch((sel) => ({ ...sel, [s.id]: productId }));
                        handleGeneratePreview(s.id, productId);
                      }}
                    />
                    {vis.productId && <LeadCaptureButton productId={vis.productId} />}
                  </div>
                )}
                {vis?.status === "failed" && (
                  <p className="text-xs text-red-500">{vis.errorMessage || "Preview generation failed."}</p>
                )}

                <div className="border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowHelpMeChoose((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {showHelpMeChoose[s.id] ? "Hide" : "Not sure? Help me choose a material"}
                  </button>

                  {showHelpMeChoose[s.id] && (
                    <div className="mt-3 space-y-3">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={getRequirements(s.id).wetArea}
                          onChange={(e) => updateRequirements(s.id, { wetArea: e.target.checked })}
                        />
                        This wall is in a moisture-prone area (kitchen/bathroom)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={getRequirements(s.id).budgetTier}
                          onChange={(e) => updateRequirements(s.id, { budgetTier: e.target.value as Requirements["budgetTier"] })}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="any">Any budget</option>
                          <option value="budget">Budget</option>
                          <option value="mid">Mid-range</option>
                          <option value="premium">Premium</option>
                        </select>
                        <select
                          value={getRequirements(s.id).priority}
                          onChange={(e) => updateRequirements(s.id, { priority: e.target.value as Requirements["priority"] })}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="any">No strong priority</option>
                          <option value="durability">Durability matters most</option>
                          <option value="low_maintenance">Low maintenance matters most</option>
                          <option value="premium_look">Premium look matters most</option>
                        </select>
                      </div>
                      <select
                        value={getRequirements(s.id).preferredCategory}
                        onChange={(e) => updateRequirements(s.id, { preferredCategory: e.target.value as Requirements["preferredCategory"] })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="any">Any material type</option>
                        <option value="paint">Paint</option>
                        <option value="wallpaper">Wallpaper</option>
                        <option value="wall_texture">Wall Texture</option>
                        <option value="wall_panel">Wall Panels</option>
                      </select>
                      <Button className="w-full" onClick={() => handleGetRecommendations(s.id)} loading={recommending[s.id]}>
                        Get recommendations
                      </Button>
                      {recommendError[s.id] && <p className="text-sm text-red-500">{recommendError[s.id]}</p>}

                      {(recommendations[s.id]?.length ?? 0) > 0 && (
                        <div className="space-y-2">
                          {recommendations[s.id].map((rec, i) => {
                            const swatchMatch = findSwatchForMaterial(rec.materialId);
                            return (
                              <div
                                key={rec.id}
                                className={`rounded-xl border p-3 ${i === 0 ? "border-indigo-300 bg-indigo-50/40" : "border-gray-200"}`}
                              >
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {i === 0 ? "🏆 " : ""}{rec.material?.name ?? "Unknown material"}
                                  </p>
                                  <span className="text-xs text-gray-400">{Math.round(rec.score * 100)}% match</span>
                                </div>
                                {rec.reasons.map((r) => (
                                  <p key={r} className="text-xs text-emerald-700">✓ {r}</p>
                                ))}
                                {rec.concerns.map((c) => (
                                  <p key={c} className="text-xs text-amber-700">⚠ {c}</p>
                                ))}
                                <CostEstimator
                                  minPerSqft={rec.material?.avgCostPerSqftMinInr}
                                  maxPerSqft={rec.material?.avgCostPerSqftMaxInr}
                                />
                                {swatchMatch ? (
                                  <Button
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => {
                                      setSelectedSwatch((sel) => ({ ...sel, [s.id]: swatchMatch.id }));
                                      handleGeneratePreview(s.id, swatchMatch.id);
                                    }}
                                  >
                                    Preview this
                                  </Button>
                                ) : (
                                  <p className="text-xs text-gray-400 mt-2">No demo swatch for this material yet — browse the <Link href="/materials/guide" className="underline">material guide</Link> for details.</p>
                                )}
                                {rec.material?.category && <LeadCaptureButton materialCategory={rec.material.category} />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="border-t border-gray-100 pt-2">
                        <Button size="sm" variant="secondary" onClick={() => handleGetCombinations(s.id)} loading={combining[s.id]}>
                          Or combine two materials on this wall
                        </Button>
                        {combineError[s.id] && <p className="text-sm text-red-500 mt-1">{combineError[s.id]}</p>}
                        {combinations[s.id] && combinations[s.id].length === 0 && (
                          <p className="text-xs text-gray-400 mt-1">No recommendable combination found for these requirements.</p>
                        )}
                        {(combinations[s.id]?.length ?? 0) > 0 && (
                          <div className="space-y-2 mt-2">
                            {combinations[s.id].map((combo, i) => (
                              <div key={i} className="rounded-xl border border-gray-200 p-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {combo.materials[0].name} + {combo.materials[1].name}
                                  </p>
                                  <span className="text-xs text-gray-400">{Math.round(combo.score * 100)}% match</span>
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5">{combo.explanation}</p>
                                <span
                                  className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                                    combo.compatibility === "high" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {combo.compatibility === "high" ? "Well-matched combination" : "Workable combination"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {room.surfaces.length >= 2 && (
            <div className="rounded-xl border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">Not sure how to treat the whole room? Get a feature-wall + surrounding-walls scheme.</p>
              <Button size="sm" variant="secondary" onClick={handleGetRoomScheme} loading={schemeLoading}>Suggest a room scheme</Button>
              {schemeError && <p className="text-xs text-red-500">{schemeError}</p>}
              {schemeResult && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-1">
                  <p className="text-sm text-gray-800">{schemeResult.explanation}</p>
                  <p className="text-xs text-gray-600">
                    Feature wall: <strong>{schemeResult.featureWall.name}</strong> ({schemeResult.featureWall.category.replace("_", " ")}) — Other walls: <strong>{schemeResult.surroundingWalls.name}</strong> (paint)
                  </p>
                </div>
              )}
            </div>
          )}

          {(() => {
            // Group confirmed walls by which repeat_sheet product they've
            // selected — only surfaced once 2+ walls share the same one
            // (adjacency is only meaningful in that case).
            const byProduct = new Map<string, Surface[]>();
            for (const sur of room.surfaces) {
              const swId = selectedSwatch[sur.id];
              const sw = swId ? swatches.find((x) => x.id === swId) : undefined;
              if (!sw || sw.patternType !== "repeat_sheet") continue;
              const list = byProduct.get(swId!) ?? [];
              list.push(sur);
              byProduct.set(swId!, list);
            }
            const entries = [...byProduct.entries()].filter(([, list]) => list.length >= 2);
            if (entries.length === 0) return null;
            return (
              <div className="space-y-3">
                {entries.map(([productId, surfacesForProduct]) => (
                  <AdjacencyMarker
                    key={productId}
                    roomId={room.id}
                    surfaces={surfacesForProduct}
                    productName={swatches.find((x) => x.id === productId)?.name ?? "this pattern"}
                    onUpdated={(updatedSurfaces) =>
                      setRoom((r) =>
                        r
                          ? { ...r, surfaces: r.surfaces.map((x) => updatedSurfaces.find((u) => u.id === x.id) ?? x) }
                          : r
                      )
                    }
                  />
                ))}
              </div>
            );
          })()}

          <div className="rounded-2xl border border-dashed border-gray-300 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Have your own wallpaper or paint photo?</p>
            <p className="text-xs text-gray-500">Upload a photo of it — we&apos;ll match its actual colour and pattern in the preview.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="flex-1 text-sm"
              />
              <input
                type="text"
                placeholder="Name (optional)"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-600">Is this a customizable design or a repeating pattern? *</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadPatternType("customizable")}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${uploadPatternType === "customizable" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"}`}
                >
                  Customizable design (one image, scales to the wall)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadPatternType("repeat_sheet")}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${uploadPatternType === "repeat_sheet" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"}`}
                >
                  Repeating pattern (comes in fixed-size sheets)
                </button>
              </div>
              {uploadPatternType === "repeat_sheet" && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    placeholder="Sheet width (ft)"
                    value={uploadSheetWidthFt}
                    onChange={(e) => setUploadSheetWidthFt(e.target.value)}
                    className="w-32 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    placeholder="Sheet height (ft)"
                    value={uploadSheetHeightFt}
                    onChange={(e) => setUploadSheetHeightFt(e.target.value)}
                    className="w-32 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
            <Button onClick={handleUploadSwatch} loading={uploading}>Upload</Button>
            {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

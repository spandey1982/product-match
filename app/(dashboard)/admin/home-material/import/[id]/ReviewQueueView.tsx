"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronUp, Check, X, Undo2, RotateCcw, Trash2, Sparkles, Copy, FileText } from "lucide-react";
import {
  ProductFormFields,
  EMPTY_PRODUCT_FORM_VALUES,
  productValuesToFormData,
  type ProductFormValues,
} from "@/components/home-material/admin/ProductFormFields";

interface MaterialOption {
  id: string;
  category: string;
  subtype: string;
  name: string;
}
interface FamilyOption {
  id: string;
  name: string;
}
interface ImportPage {
  id: string;
  pageNumber: number;
  pageType: string;
  extractedImageUrl: string | null;
  extractedFields: string;
  aiClassification: string | null;
  reviewStatus: string;
  resultingProductId: string | null;
}
interface CatalogueImportFull {
  id: string;
  collection: string;
  brand: string | null;
  sourceFileName: string;
  status: string;
  errorMessage: string | null;
  collectionFields: string | null;
  pages: ImportPage[];
}

const PAGE_TYPE_LABEL: Record<string, string> = {
  product: "Looks like a product",
  info: "Looks like an info/reference page",
  noise: "Looks blank/noise",
  ambiguous: "Ambiguous — needs a human call",
};

// AI role display metadata + queue ordering priority (lower sorts first).
// This is a TRIAGE aid only — every candidate stays visible and reachable
// regardless of role, including "noise" and unclassified (null); never a
// filter that can hide a real product from review (explicit instruction).
const AI_ROLE_META: Record<string, { label: string; className: string; priority: number }> = {
  clean_tile: { label: "AI: looks like a clean tile", className: "bg-emerald-50 text-emerald-700", priority: 0 },
  texture_closeup: { label: "AI: texture close-up", className: "bg-amber-50 text-amber-700", priority: 2 },
  lifestyle: { label: "AI: lifestyle photo", className: "bg-sky-50 text-sky-700", priority: 3 },
  group_shot: { label: "AI: multiple products together", className: "bg-orange-50 text-orange-700", priority: 4 },
  noise: { label: "AI: probably not a product", className: "bg-gray-100 text-gray-500", priority: 5 },
};
const UNCLASSIFIED_PRIORITY = 1; // between clean_tile and everything AI thinks is probably not the main event

// Fields that genuinely tend to be shared across colourway siblings of the
// same design (per user's own example: finish/material/etc. apply to
// "all of that kind") — deliberately excludes name/sku/colorName/colorHex/
// familyId, which are exactly what's SUPPOSED to differ between siblings.
const SHAREABLE_FIELD_KEYS: (keyof ProductFormValues)[] = [
  "materialId",
  "finish",
  "materialComposition",
  "patternCategory",
  "visualStyle",
  "installationMethod",
  "sampleAvailable",
  "patternName",
  "patternRepeatCm",
  "orientation",
  "dimensions",
  "patternType",
  "sheetWidthM",
  "sheetHeightM",
  "minWidthM",
  "minHeightM",
  "priceInr",
  "priceUnit",
  "warrantyInfo",
];

function pickShareable(values: ProductFormValues): Partial<ProductFormValues> {
  const out: Partial<ProductFormValues> = {};
  for (const key of SHAREABLE_FIELD_KEYS) {
    if (values[key]) out[key] = values[key];
  }
  return out;
}

// Groups codes like "101/1"/"101/2" or "850-3" as family "101"/"850" —
// informational only (shown as a badge); doesn't drive any automatic
// behaviour, since HmProduct.familyId stays MANUAL-only per its own
// doc comment in prisma/schema.prisma.
function codePrefix(sku: string | null): string | null {
  if (!sku) return null;
  const m = /^(\d{2,5})[\/\-]\d+/.exec(sku.trim());
  return m ? m[1] : null;
}

interface CollectionFields {
  materialComposition: string | null;
  installationMethod: string | null;
  warrantyInfo: string | null;
  description: string | null;
  claims: string[];
}
function parseCollectionFields(raw: string | null): CollectionFields | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      materialComposition: p.materialComposition ?? null,
      installationMethod: p.installationMethod ?? null,
      warrantyInfo: p.warrantyInfo ?? null,
      description: p.description ?? null,
      claims: Array.isArray(p.claims) ? p.claims : [],
    };
  } catch {
    return null;
  }
}

interface AiClassification {
  role: string;
  confidence: number | null;
  finishGuess: string | null;
  colorHint: string | null;
}
function parseAiClassification(raw: string | null): AiClassification | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return { role: p.role ?? null, confidence: p.confidence ?? null, finishGuess: p.finishGuess ?? null, colorHint: p.colorHint ?? null };
  } catch {
    return null;
  }
}

function parseExtracted(raw: string): { name: string | null; sku: string | null; rawText: string } {
  try {
    const parsed = JSON.parse(raw);
    return { name: parsed.name ?? null, sku: parsed.sku ?? null, rawText: parsed.rawText ?? "" };
  } catch {
    return { name: null, sku: null, rawText: "" };
  }
}

async function reviewPage(importId: string, pageId: string, formData: FormData) {
  const res = await fetch(`/api/admin/home-material/catalogue-imports/${importId}/pages/${pageId}`, {
    method: "PATCH",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function PageCard({
  page,
  importId,
  importCollection,
  importBrand,
  materials,
  families,
  selected,
  onToggleSelect,
  bulkBusy,
  lastSharedFields,
  collectionFields,
  onApproved,
  onRejected,
}: {
  page: ImportPage;
  importId: string;
  importCollection: string;
  importBrand: string | null;
  materials: MaterialOption[];
  families: FamilyOption[];
  selected: boolean;
  onToggleSelect: () => void;
  bulkBusy: boolean;
  lastSharedFields: Partial<ProductFormValues> | null;
  collectionFields: CollectionFields | null;
  onApproved: (shared: Partial<ProductFormValues>) => void;
  onRejected: (pageId: string, pageNumber: number) => void;
}) {
  const extracted = parseExtracted(page.extractedFields);
  const ai = parseAiClassification(page.aiClassification);
  const family = codePrefix(extracted.sku);
  // Collapsed by default regardless of pageType: a real catalogue PDF can
  // yield well over 100 product candidates (every qualifying photo on
  // every page), so defaulting every card open would make the queue
  // unusable. The admin expands one at a time to review/approve it.
  const [expanded, setExpanded] = useState(false);
  const [showText, setShowText] = useState(false);
  const [values, setValues] = useState<ProductFormValues>({
    ...EMPTY_PRODUCT_FORM_VALUES,
    name: extracted.name ?? "",
    sku: extracted.sku ?? "",
    collection: importCollection,
    brand: importBrand ?? "",
    finish: ai?.finishGuess ?? "",
    colorName: ai?.colorHint ?? "",
  });
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function submit(action: "approve" | "reject") {
    setLoading(action);
    setError("");
    try {
      const fd = action === "approve" ? productValuesToFormData(values) : new FormData();
      fd.set("action", action);
      await reviewPage(importId, page.id, fd);
      if (action === "approve") onApproved(pickShareable(values));
      else onRejected(page.id, page.pageNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action}`);
    } finally {
      setLoading(null);
    }
  }

  const disabled = loading !== null || bulkBusy;
  const roleMeta = ai?.role ? AI_ROLE_META[ai.role] : null;

  return (
    <div className={`bg-white border rounded-2xl p-4 ${selected ? "border-indigo-300 ring-1 ring-indigo-200" : "border-gray-200"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0 disabled:opacity-50"
          aria-label={`Select page ${page.pageNumber}`}
        />
        {page.extractedImageUrl ? (
          <Image src={page.extractedImageUrl} alt="" width={64} height={64} className="rounded-lg object-cover border border-gray-200 shrink-0" unoptimized />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
            No image found
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold text-gray-900">Page {page.pageNumber}</p>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {family && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-mono">
                  family {family}
                </span>
              )}
              {roleMeta && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleMeta.className}`}>
                  {roleMeta.label}
                </span>
              )}
              <span className="text-[10px] text-gray-400">{PAGE_TYPE_LABEL[page.pageType] ?? page.pageType}</span>
            </div>
          </div>
          {extracted.name && <p className="text-xs text-gray-600 mt-0.5">Guessed name: {extracted.name}</p>}
          {extracted.sku && <p className="text-[11px] text-gray-400">Guessed SKU: {extracted.sku}</p>}
          {(ai?.finishGuess || ai?.colorHint) && (
            <p className="text-[11px] text-gray-400">
              AI hints: {[ai.finishGuess, ai.colorHint].filter(Boolean).join(" · ")}
            </p>
          )}
          <button
            onClick={() => setShowText((v) => !v)}
            className="text-[11px] text-indigo-600 hover:underline mt-1"
          >
            {showText ? "Hide" : "Show"} raw page text
          </button>
          {showText && (
            <p className="text-[11px] text-gray-500 mt-1 bg-gray-50 rounded-lg p-2 max-h-24 overflow-y-auto">
              {extracted.rawText || "(no text found on this page)"}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 text-gray-400 hover:text-gray-700 shrink-0"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            {lastSharedFields && Object.keys(lastSharedFields).length > 0 && (
              <button
                type="button"
                onClick={() => setValues((v) => ({ ...v, ...lastSharedFields }))}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <Copy size={11} />
                Copy shared fields from last approved
              </button>
            )}
            {collectionFields && (
              <button
                type="button"
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    materialComposition: collectionFields.materialComposition || v.materialComposition,
                    installationMethod: collectionFields.installationMethod || v.installationMethod,
                    warrantyInfo: collectionFields.warrantyInfo || v.warrantyInfo,
                    description: collectionFields.description || v.description,
                  }))
                }
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
              >
                <FileText size={11} />
                Fill from collection info
              </button>
            )}
          </div>
          <ProductFormFields
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            materials={materials}
            families={families}
          />
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={() => submit("reject")}
          disabled={disabled}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
        >
          <X size={12} />
          {loading === "reject" ? "Rejecting..." : "Reject"}
        </button>
        <button
          onClick={() => submit("approve")}
          disabled={disabled}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
        >
          <Check size={12} />
          {loading === "approve" ? "Creating..." : "Approve → create draft product"}
        </button>
      </div>
    </div>
  );
}

export function ReviewQueueView({
  catalogueImport,
  materials,
  families,
}: {
  catalogueImport: CatalogueImportFull;
  materials: MaterialOption[];
  families: FamilyOption[];
}) {
  const router = useRouter();
  const pending = [...catalogueImport.pages.filter((p) => p.reviewStatus === "pending")].sort((a, b) => {
    const roleA = parseAiClassification(a.aiClassification)?.role;
    const roleB = parseAiClassification(b.aiClassification)?.role;
    const pA = roleA ? AI_ROLE_META[roleA]?.priority ?? UNCLASSIFIED_PRIORITY : UNCLASSIFIED_PRIORITY;
    const pB = roleB ? AI_ROLE_META[roleB]?.priority ?? UNCLASSIFIED_PRIORITY : UNCLASSIFIED_PRIORITY;
    if (pA !== pB) return pA - pB;
    return a.pageNumber - b.pageNumber;
  });
  const resolved = catalogueImport.pages.filter((p) => p.reviewStatus !== "pending");
  const collectionFields = parseCollectionFields(catalogueImport.collectionFields);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkError, setBulkError] = useState("");
  // Undo toast for the most recent reject (single or bulk) — see
  // UNDO_WINDOW_MS. Cleared early by a manual Undo click, or once a new
  // reject replaces it (only the most recent batch is undoable this way;
  // anything older falls back to the Reviewed list's untimed Restore).
  const [recentlyRejected, setRecentlyRejected] = useState<{ ids: string[]; pageNumbers: number[] } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  // The last approved candidate's shareable fields — offered as a
  // one-click fill for the next card, matching how a reviewer actually
  // works through a colourway family (fill one in fully, reuse for the
  // rest, tweak only what differs). See SHAREABLE_FIELD_KEYS.
  const [lastSharedFields, setLastSharedFields] = useState<Partial<ProductFormValues> | null>(null);

  const UNDO_WINDOW_MS = 8000;

  useEffect(() => {
    if (!recentlyRejected) return;
    const t = setTimeout(() => setRecentlyRejected(null), UNDO_WINDOW_MS);
    return () => clearTimeout(t);
  }, [recentlyRejected]);

  function resetSelection() {
    setSelected(new Set());
  }

  function handleApproved(shared: Partial<ProductFormValues>) {
    resetSelection();
    if (Object.keys(shared).length > 0) setLastSharedFields(shared);
    router.refresh();
  }

  function handleRejected(pageId: string, pageNumber: number) {
    resetSelection();
    setRecentlyRejected({ ids: [pageId], pageNumbers: [pageNumber] });
    router.refresh();
  }

  function toggleSelect(pageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === pending.length ? new Set() : new Set(pending.map((p) => p.id))));
  }

  async function handleBulkReject() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkRejecting(true);
    setBulkError("");
    try {
      const results = await Promise.allSettled(
        ids.map((pageId) => {
          const fd = new FormData();
          fd.set("action", "reject");
          return reviewPage(catalogueImport.id, pageId, fd);
        })
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        setBulkError(`${failedCount} of ${ids.length} couldn't be rejected — they may have already been reviewed elsewhere.`);
      }
      const succeededIds = ids.filter((_, i) => results[i].status === "fulfilled");
      if (succeededIds.length > 0) {
        setRecentlyRejected({
          ids: succeededIds,
          pageNumbers: pending.filter((p) => succeededIds.includes(p.id)).map((p) => p.pageNumber),
        });
      }
      resetSelection();
      router.refresh();
    } finally {
      setBulkRejecting(false);
    }
  }

  async function handleUndo() {
    if (!recentlyRejected) return;
    setUndoing(true);
    try {
      await Promise.all(
        recentlyRejected.ids.map((pageId) => {
          const fd = new FormData();
          fd.set("action", "restore");
          return reviewPage(catalogueImport.id, pageId, fd);
        })
      );
      setRecentlyRejected(null);
      router.refresh();
    } finally {
      setUndoing(false);
    }
  }

  async function handleRestore(pageId: string) {
    setRestoringId(pageId);
    setRowError((e) => ({ ...e, [pageId]: "" }));
    try {
      const fd = new FormData();
      fd.set("action", "restore");
      await reviewPage(catalogueImport.id, pageId, fd);
      router.refresh();
    } catch (err) {
      setRowError((e) => ({ ...e, [pageId]: err instanceof Error ? err.message : "Could not restore" }));
    } finally {
      setRestoringId(null);
    }
  }

  async function handleDeleteAllReviewed() {
    if (resolved.length === 0) return;
    if (!window.confirm(`Permanently delete all ${resolved.length} reviewed entries? Rejected ones can no longer be restored after this. Approved products already created are not affected.`)) {
      return;
    }
    setDeletingAll(true);
    try {
      const res = await fetch(`/api/admin/home-material/catalogue-imports/${catalogueImport.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBulkError(data.error || "Could not delete the reviewed list");
        return;
      }
      setRecentlyRejected(null);
      router.refresh();
    } finally {
      setDeletingAll(false);
    }
  }

  const allSelected = pending.length > 0 && selected.size === pending.length;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link href="/admin/home-material/import" className="text-xs text-indigo-600 hover:underline">
        ← All imports
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mt-2">{catalogueImport.collection}</h1>
      <p className="text-sm text-gray-500 mt-1">
        {catalogueImport.sourceFileName} · {catalogueImport.pages.length} pages · {pending.length} pending review
      </p>
      {catalogueImport.errorMessage && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg p-2">{catalogueImport.errorMessage}</p>
      )}

      {collectionFields && (
        <div className="mt-4 bg-sky-50 border border-sky-100 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-sky-800 flex items-center gap-1.5">
            <Sparkles size={12} />
            Collection info found in this PDF&apos;s reference pages
          </p>
          <div className="mt-1.5 space-y-0.5 text-xs text-sky-900">
            {collectionFields.materialComposition && <p>Material: {collectionFields.materialComposition}</p>}
            {collectionFields.installationMethod && <p>Installation: {collectionFields.installationMethod}</p>}
            {collectionFields.warrantyInfo && <p>Warranty: {collectionFields.warrantyInfo}</p>}
            {collectionFields.description && <p className="text-sky-700">{collectionFields.description}</p>}
            {collectionFields.claims.length > 0 && (
              <p className="text-sky-700">Claims: {collectionFields.claims.join(", ")}</p>
            )}
          </div>
          <p className="text-[10px] text-sky-600 mt-1.5">
            Use each card&apos;s &quot;Fill from collection info&quot; button to apply this — nothing is filled in automatically.
          </p>
        </div>
      )}

      {recentlyRejected && (
        <div className="mt-4 flex items-center justify-between gap-3 bg-gray-800 text-white rounded-xl px-4 py-2.5">
          <p className="text-xs">
            Rejected page{recentlyRejected.pageNumbers.length > 1 ? "s" : ""} {recentlyRejected.pageNumbers.join(", ")}.
          </p>
          <button
            onClick={handleUndo}
            disabled={undoing}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200 disabled:opacity-50 shrink-0"
          >
            <Undo2 size={12} />
            {undoing ? "Undoing..." : "Undo"}
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <button
              onClick={handleBulkReject}
              disabled={bulkRejecting}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-white hover:bg-red-600 bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
            >
              <X size={12} />
              {bulkRejecting ? "Rejecting..." : `Reject ${selected.size} selected`}
            </button>
          )}
        </div>
      )}
      {bulkError && <p className="text-xs text-red-600 mt-2">{bulkError}</p>}

      <div className="mt-4 space-y-4">
        {pending.map((page) => (
          <PageCard
            key={page.id}
            page={page}
            importId={catalogueImport.id}
            importCollection={catalogueImport.collection}
            importBrand={catalogueImport.brand}
            materials={materials}
            families={families}
            selected={selected.has(page.id)}
            onToggleSelect={() => toggleSelect(page.id)}
            bulkBusy={bulkRejecting}
            lastSharedFields={lastSharedFields}
            collectionFields={collectionFields}
            onApproved={handleApproved}
            onRejected={handleRejected}
          />
        ))}
        {pending.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-xs text-gray-400">
            Every page has been reviewed.
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Already reviewed</p>
            <button
              onClick={handleDeleteAllReviewed}
              disabled={deletingAll}
              className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 size={11} />
              {deletingAll ? "Deleting..." : "Delete all"}
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {resolved.map((p) => {
                  const extracted = parseExtracted(p.extractedFields);
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2 w-14">
                        {p.extractedImageUrl ? (
                          <Image src={p.extractedImageUrl} alt="" width={36} height={36} className="rounded-lg object-cover border border-gray-200" unoptimized />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200" />
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-500">
                        Page {p.pageNumber}
                        {extracted.name && <span className="text-gray-400"> · {extracted.name}</span>}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <span className={p.reviewStatus === "approved" ? "text-emerald-700" : "text-gray-500"}>
                          {p.reviewStatus === "approved" ? "Approved" : "Rejected"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-right">
                        <div className="flex items-center justify-end gap-3">
                          {p.resultingProductId && (
                            <Link href="/admin/home-material/products" className="text-indigo-600 hover:underline">
                              View in catalogue
                            </Link>
                          )}
                          {p.reviewStatus === "rejected" && (
                            <button
                              onClick={() => handleRestore(p.id)}
                              disabled={restoringId === p.id}
                              className="flex items-center gap-1 text-gray-400 hover:text-indigo-600 disabled:opacity-50"
                            >
                              <RotateCcw size={11} />
                              {restoringId === p.id ? "Restoring..." : "Restore"}
                            </button>
                          )}
                        </div>
                        {rowError[p.id] && <p className="text-red-600 mt-1">{rowError[p.id]}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

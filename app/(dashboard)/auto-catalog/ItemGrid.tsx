"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, AlertTriangle, X, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutoCatalogItem } from "./types";

const STAGE_LABELS: Record<string, string> = {
  uploaded:         "Uploaded",
  classifying:      "Classifying...",
  unknown:          "Needs Category",
  cataloging:       "Cataloging...",
  generating_images:"Generating Images...",
  qc_running:       "Running QC...",
  retrying:         "Retrying...",
  manual_qc:        "Manual Review",
  ready:            "Ready",
  published:        "Published",
  failed:           "Failed",
};

const STAGE_COLORS: Record<string, string> = {
  uploaded:         "bg-gray-100 text-gray-600",
  classifying:      "bg-blue-100 text-blue-700",
  unknown:          "bg-yellow-100 text-yellow-700",
  cataloging:       "bg-indigo-100 text-indigo-700",
  generating_images:"bg-purple-100 text-purple-700",
  qc_running:       "bg-cyan-100 text-cyan-700",
  retrying:         "bg-orange-100 text-orange-700",
  manual_qc:        "bg-red-100 text-red-700",
  ready:            "bg-green-100 text-green-700",
  published:        "bg-emerald-100 text-emerald-700",
  failed:           "bg-red-100 text-red-600",
};

const PROCESSING_STAGES = new Set([
  "classifying", "cataloging", "generating_images", "qc_running", "retrying",
]);

const CATEGORIES = [
  "Saree", "Lehenga", "Blouse", "Dupatta", "Kurta", "Salwar", "Anarkali",
  "Sharara", "Palazzo", "Shirt", "Trouser", "Jewellery", "Footwear", "Clutch",
  "Handbag", "Suit", "Tie", "Other",
];

interface Props {
  items: AutoCatalogItem[];
  onAssignCategory: (itemId: string, category: string) => Promise<void>;
  onApprove: (itemId: string) => Promise<void>;
  onRetry: (itemId: string) => Promise<void>;
}

function ItemCard({
  item,
  onAssignCategory,
  onApprove,
  onRetry,
}: {
  item: AutoCatalogItem;
  onAssignCategory: (itemId: string, category: string) => Promise<void>;
  onApprove: (itemId: string) => Promise<void>;
  onRetry: (itemId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedCat, setSelectedCat] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const catalog = item.catalogResult ? JSON.parse(item.catalogResult) : null;
  const qc = item.qcResult ? JSON.parse(item.qcResult) : null;
  const isProcessing = PROCESSING_STAGES.has(item.stage);

  async function handleAssign() {
    if (!selectedCat) return;
    setAssigning(true);
    await onAssignCategory(item.id, selectedCat);
    setAssigning(false);
  }

  async function handleApprove() {
    setApproving(true);
    await onApprove(item.id);
    setApproving(false);
  }

  async function handleRetry() {
    setRetrying(true);
    await onRetry(item.id);
    setRetrying(false);
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
      {/* Image */}
      <div className="relative aspect-[3/4] bg-gray-50">
        <Image
          src={item.imageUrl}
          alt={item.fileName || "Product"}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {/* Stage badge */}
        <div className="absolute top-2 left-2">
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${STAGE_COLORS[item.stage] ?? "bg-gray-100 text-gray-600"}`}>
            {isProcessing && (
              <RefreshCw className="h-3 w-3 animate-spin" />
            )}
            {item.stage === "published" && <Check className="h-3 w-3" />}
            {item.stage === "failed" && <X className="h-3 w-3" />}
            {item.stage === "manual_qc" && <AlertTriangle className="h-3 w-3" />}
            {STAGE_LABELS[item.stage] ?? item.stage}
          </span>
        </div>
        {/* QC score badge */}
        {qc && (
          <div className="absolute top-2 right-2">
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
              qc.score >= 70 ? "bg-green-100 text-green-700" :
              qc.score >= 50 ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>
              QC {qc.score}
            </span>
          </div>
        )}
      </div>

      {/* Info strip */}
      <div className="p-3 space-y-2">
        {catalog && (
          <div>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {String(catalog.title?.value || "")}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {String(catalog.category?.value || "")}
              {catalog.color?.value ? ` · ${String(catalog.color.value)}` : ""}
            </p>
          </div>
        )}

        {!catalog && item.stage !== "uploaded" && (
          <p className="text-xs text-gray-400 italic">Processing...</p>
        )}

        {/* Unknown — assign category */}
        {item.stage === "unknown" && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-yellow-700">
              AI couldn&apos;t identify this product. Assign a category to continue.
            </p>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">Select category...</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              disabled={!selectedCat || assigning}
              onClick={handleAssign}
            >
              {assigning ? "Resuming..." : "Resume Pipeline"}
            </Button>
          </div>
        )}

        {/* Manual QC — approve */}
        {item.stage === "manual_qc" && (
          <div className="space-y-2 pt-1">
            {qc?.failedFields?.length > 0 && (
              <p className="text-xs text-red-600">
                Failed: {qc.failedFields.join(", ")}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs"
                onClick={() => setExpanded((v) => !v)}
              >
                <Eye className="h-3 w-3 mr-1" />
                Review
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                disabled={approving}
                onClick={handleApprove}
              >
                {approving ? "Approving..." : "Approve"}
              </Button>
            </div>
          </div>
        )}

        {/* Failed */}
        {item.stage === "failed" && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-red-500 line-clamp-2">
              {item.failureReason || "Unknown error"}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
              disabled={retrying}
              onClick={handleRetry}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying..." : "Retry from start"}
            </Button>
          </div>
        )}

        {/* Expanded catalog view */}
        {expanded && catalog && (
          <div className="pt-2 border-t border-gray-100 space-y-1">
            {Object.entries(catalog).map(([key, field]) => {
              const f = field as { value: unknown; confidence: number };
              const val = Array.isArray(f.value) ? f.value.join(", ") : String(f.value);
              if (!val) return null;
              return (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 capitalize">{key}</span>
                  <span className="text-gray-800 font-medium truncate max-w-[60%] text-right">
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ItemGrid({ items, onAssignCategory, onApprove, onRetry }: Props) {
  const [filter, setFilter] = useState<string>("all");

  const filters = [
    { key: "all",       label: "All" },
    { key: "unknown",   label: "Needs Review" },
    { key: "manual_qc", label: "Manual QC" },
    { key: "published", label: "Published" },
    { key: "failed",    label: "Failed" },
  ];

  const visible = filter === "all"
    ? items
    : items.filter((i) => i.stage === filter);

  if (!items.length) return null;

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((f) => {
          const count = f.key === "all"
            ? items.length
            : items.filter((i) => i.stage === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {visible.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onAssignCategory={onAssignCategory}
            onApprove={onApprove}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  );
}

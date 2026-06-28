"use client";

import type { AutoCatalogBatch } from "./types";

interface Props {
  batch: AutoCatalogBatch;
}

interface Stage {
  label: string;
  count: number;
  color: string;
  active: boolean;
}

export function PipelineDashboard({ batch }: Props) {
  const isRunning = batch.status === "running";

  const stages: Stage[] = [
    { label: "Uploaded",    count: batch.uploadedCount,   color: "bg-gray-400",   active: false },
    { label: "Classified",  count: batch.classifiedCount, color: "bg-blue-500",   active: isRunning },
    { label: "Unknown",     count: batch.unknownCount,    color: "bg-yellow-500", active: false },
    { label: "Cataloged",   count: batch.catalogedCount,  color: "bg-indigo-500", active: isRunning },
    { label: "Images Done", count: batch.imagedCount,     color: "bg-purple-500", active: isRunning },
    { label: "QC Passed",   count: batch.qcPassedCount,   color: "bg-green-500",  active: isRunning },
    { label: "Retrying",    count: batch.retryingCount,   color: "bg-orange-500", active: isRunning },
    { label: "Manual QC",   count: batch.manualQcCount,   color: "bg-red-500",    active: false },
    { label: "Published",   count: batch.publishedCount,  color: "bg-emerald-500",active: false },
  ];

  const total = batch.totalCount || 1;
  const progressPct = Math.round((batch.publishedCount / total) * 100);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Pipeline Progress</h2>
          <p className="text-sm text-gray-500">
            {batch.totalCount} products · {batch.publishedCount} published
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
          <span className="text-sm font-medium text-gray-600 capitalize">{batch.status}</span>
        </div>
      </div>

      {/* Overall progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>Overall progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stage counters */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {stages.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-3 text-center"
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className={`h-2 w-2 rounded-full ${s.color} ${s.active && s.count > 0 ? "animate-pulse" : ""}`} />
              <span className="text-[11px] font-medium text-gray-500">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{s.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

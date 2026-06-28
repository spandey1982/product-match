"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Sparkles, Bot, History, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineDashboard } from "./PipelineDashboard";
import { ItemGrid } from "./ItemGrid";
import type { AutoCatalogBatch, AutoCatalogItem } from "./types";

type View = "upload" | "pipeline" | "history";

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-600",
  running:   "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  paused:    "bg-yellow-100 text-yellow-700",
};

export function AutoCatalogView() {
  const [view, setView] = useState<View>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<AutoCatalogBatch | null>(null);
  const [items, setItems] = useState<AutoCatalogItem[]>([]);
  const [batches, setBatches] = useState<AutoCatalogBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/auto-catalog/batches");
      const data = await res.json();
      setBatches(data.batches ?? []);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function openBatch(batchId: string) {
    const res = await fetch(`/api/auto-catalog/batches/${batchId}`);
    const data = await res.json();
    setBatch(data.batch);
    setItems(data.items);
    setView("pipeline");
    if (data.batch.status === "running") startPolling(batchId);
  }

  useEffect(() => {
    if (view === "history") {
      setTimeout(() => void loadHistory(), 0);
    }
  }, [view]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const valid = Array.from(incoming).filter((f) => allowed.includes(f.type));
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...valid.filter((f) => !existing.has(f.name + f.size))];
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const startPolling = useCallback((batchId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/auto-catalog/batches/${batchId}`);
      if (!res.ok) return;
      const data = await res.json();
      setBatch(data.batch);
      setItems(data.items);
      if (data.batch.status === "completed") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
  }, []);

  async function handleStart() {
    if (!files.length) return;
    setError(null);
    setUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      setUploadProgress(40);
      const uploadRes = await fetch("/api/auto-catalog/batches", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }

      const { batchId } = await uploadRes.json();
      setUploadProgress(70);

      // Start pipeline — returns item ids to process
      const startRes = await fetch(`/api/auto-catalog/batches/${batchId}/start`, { method: "POST" });
      const { itemIds } = await startRes.json();
      setUploadProgress(100);

      // Load initial batch state and switch to pipeline view
      const batchRes = await fetch(`/api/auto-catalog/batches/${batchId}`);
      const batchData = await batchRes.json();
      setBatch(batchData.batch);
      setItems(batchData.items);
      setView("pipeline");

      // Start polling for live updates
      startPolling(batchId);

      // Process each item sequentially — each call blocks until the item finishes
      // This keeps the pipeline alive since Next.js terminates fire-and-forget promises
      for (const itemId of itemIds) {
        await fetch(`/api/auto-catalog/items/${itemId}/process`, { method: "POST" });
      }

      // Mark batch completed
      await fetch(`/api/auto-catalog/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }

  function resumePolling() {
    if (batch) startPolling(batch.id);
  }

  async function handleAssignCategory(itemId: string, category: string) {
    await fetch(`/api/auto-catalog/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    resumePolling();
    await fetch(`/api/auto-catalog/items/${itemId}/process`, { method: "POST" });
  }

  async function handleApprove(itemId: string) {
    await fetch(`/api/auto-catalog/items/${itemId}`, { method: "POST" });
    resumePolling();
  }

  async function handleRetry(itemId: string) {
    await fetch(`/api/auto-catalog/items/${itemId}/retry`, { method: "POST" });
    resumePolling();
    await fetch(`/api/auto-catalog/items/${itemId}/process`, { method: "POST" });
  }

  if (view === "history") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <History className="h-6 w-6 text-indigo-600" />
              Previous Batches
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Your last 20 autonomous catalog runs
            </p>
          </div>
          <Button variant="outline" onClick={() => { setView("upload"); setFiles([]); }}>
            New Batch
          </Button>
        </div>

        {loadingHistory ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No previous batches found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((b) => (
              <button
                key={b.id}
                onClick={() => openBatch(b.id)}
                className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 flex items-center justify-between hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors text-left"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {b.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(b.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{b.totalCount} uploaded</span>
                    <span className="text-emerald-600 font-medium">{b.publishedCount} published</span>
                    {b.manualQcCount > 0 && (
                      <span className="text-red-500">{b.manualQcCount} needs review</span>
                    )}
                    {b.unknownCount > 0 && (
                      <span className="text-yellow-600">{b.unknownCount} unknown</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view === "pipeline" && batch) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="h-6 w-6 text-indigo-600" />
              Autonomous Catalog
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              AI is processing your products autonomously
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setView("history")}>
              <History className="h-4 w-4 mr-1.5" />
              Previous Batches
            </Button>
            <Button variant="outline" onClick={() => { setView("upload"); setFiles([]); }}>
              New Batch
            </Button>
          </div>
        </div>

        <PipelineDashboard batch={batch} />

        <ItemGrid
          items={items}
          onAssignCategory={handleAssignCategory}
          onApprove={handleApprove}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Autonomous Catalog</h1>
        </div>
        <p className="text-gray-500">
          Upload product photos and the AI handles classification, cataloging, image generation, and QC automatically.
        </p>
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setView("history")}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <History className="h-4 w-4" />
            View previous batches
          </button>
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
        }`}
      >
        <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <p className="text-lg font-medium text-gray-700">
          Drop images here or click to browse
        </p>
        <p className="text-sm text-gray-400 mt-1">
          JPEG, PNG, WebP — single image, multiple images, or entire folders
        </p>
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            Select Images
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
          >
            Select Folder
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          // @ts-expect-error — webkitdirectory is non-standard
          webkitdirectory=""
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Selected files list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {files.length} image{files.length !== 1 ? "s" : ""} selected
          </p>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-gray-700 truncate">{f.name}</span>
                <span className="text-gray-400 ml-4 shrink-0">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setFiles([])}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Uploading and starting pipeline...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Pipeline stages preview */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          What happens after you click Start
        </p>
        <div className="space-y-3">
          {[
            { icon: "🔍", label: "AI Classification", desc: "Identifies category and groups related images" },
            { icon: "📝", label: "AI Catalog Generation", desc: "Generates title, description, color, material, occasion and more" },
            { icon: "🖼️", label: "AI Image Generation", desc: "Creates professional model images for your catalog" },
            { icon: "✅", label: "AI Quality Control", desc: "Validates catalog completeness and image quality" },
            { icon: "🔄", label: "Auto Retry", desc: "Automatically fixes failed attributes and images" },
            { icon: "🚀", label: "Publish", desc: "Approved products appear in your catalog immediately" },
          ].map((s) => (
            <div key={s.label} className="flex items-start gap-3">
              <span className="text-lg">{s.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-800">{s.label}</p>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start button */}
      <Button
        className="w-full h-12 text-base"
        disabled={!files.length || uploading}
        onClick={handleStart}
      >
        <Sparkles className="h-5 w-5 mr-2" />
        {uploading ? "Starting..." : `Start AI Processing (${files.length} image${files.length !== 1 ? "s" : ""})`}
      </Button>
    </div>
  );
}

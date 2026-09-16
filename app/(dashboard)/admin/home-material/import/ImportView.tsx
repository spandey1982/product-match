"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UploadCloud, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ImportRow {
  id: string;
  collection: string;
  brand: string | null;
  sourceFileName: string;
  status: string;
  errorMessage: string | null;
  pageCount: number;
  pagesProcessed: number;
  createdAt: string;
  uploadedByUser: { name: string; email: string };
  counts: Record<string, number>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    processing: "bg-blue-50 text-blue-700",
    needs_review: "bg-amber-50 text-amber-700",
    cancelled: "bg-gray-100 text-gray-600",
    completed: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
  };
  const labels: Record<string, string> = {
    processing: "Processing",
    needs_review: "Needs review",
    cancelled: "Stopped early",
    completed: "Completed",
    failed: "Failed",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[status] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function ImportView({ initialImports }: { initialImports: ImportRow[] }) {
  const router = useRouter();
  const imports = initialImports;
  const [collection, setCollection] = useState("");
  const [brand, setBrand] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const [processing, setProcessing] = useState<{ importId: string; pagesProcessed: number; totalPages: number } | null>(null);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stopRequestedRef = useRef(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!collection.trim()) {
      setError("Collection name is required");
      return;
    }
    if (!file) {
      setError("Choose a PDF to upload");
      return;
    }

    stopRequestedRef.current = false;
    try {
      const fd = new FormData();
      fd.set("collection", collection.trim());
      if (brand.trim()) fd.set("brand", brand.trim());
      fd.set("file", file);
      const res = await fetch("/api/admin/home-material/catalogue-imports", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }
      const importId = data.importId as string;
      setProcessing({ importId, pagesProcessed: 0, totalPages: data.totalPages });
      await runProcessingLoop(importId);
    } catch {
      setError("Network error. Please try again.");
      setProcessing(null);
    }
  }

  async function runProcessingLoop(importId: string) {
    while (!stopRequestedRef.current) {
      let res: Response;
      try {
        res = await fetch(`/api/admin/home-material/catalogue-imports/${importId}/process-next`, { method: "POST" });
      } catch {
        setError("Lost connection while processing — the pages found so far are still saved. Try opening the import to continue reviewing.");
        break;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Processing failed partway through.");
        break;
      }
      setProcessing({ importId, pagesProcessed: data.pagesProcessed, totalPages: data.totalPages });
      if (data.done) break;
    }
    router.push(`/admin/home-material/import/${importId}`);
  }

  async function handleConfirmStop() {
    if (!processing) return;
    setStopping(true);
    try {
      await fetch(`/api/admin/home-material/catalogue-imports/${processing.importId}/cancel`, { method: "POST" });
      stopRequestedRef.current = true;
    } finally {
      setStopping(false);
      setConfirmStopOpen(false);
    }
  }

  if (processing) {
    const pct = processing.totalPages > 0 ? Math.round((processing.pagesProcessed / processing.totalPages) * 100) : 0;
    return (
      <div className="max-w-lg mx-auto pb-16 pt-12">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-center">
          <h1 className="text-base font-semibold text-gray-900">Reading &quot;{file?.name}&quot;</h1>
          <p className="text-sm text-gray-500 mt-1">
            Page {Math.min(processing.pagesProcessed + 1, processing.totalPages)} of {processing.totalPages}
          </p>
          <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Each page is scanned for product photos as it goes — you don&apos;t need to wait for the whole file if something looks wrong.
          </p>
          <button
            onClick={() => setConfirmStopOpen(true)}
            className="mt-5 flex items-center gap-1.5 mx-auto px-4 py-2 text-xs font-medium text-gray-600 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Square size={11} />
            Stop importing
          </button>
        </div>

        <Dialog open={confirmStopOpen} onOpenChange={setConfirmStopOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stop this import?</DialogTitle>
              <DialogDescription>
                Pages {processing.pagesProcessed} of {processing.totalPages} have already been scanned and will stay
                as reviewable candidates. The remaining pages will be skipped — you can always re-upload the same
                PDF later to pick up where you left off.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                onClick={() => setConfirmStopOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
              >
                Keep going
              </button>
              <button
                onClick={handleConfirmStop}
                disabled={stopping}
                className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {stopping ? "Stopping..." : "Stop and review what's found"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <h1 className="text-xl font-bold text-gray-900">Catalogue PDF Import</h1>
      <p className="text-sm text-gray-500 mt-1">
        Upload a per-collection PDF. Pages are automatically read and sorted into product/info/noise candidates —
        nothing is added to the catalogue until you review and approve each one.
      </p>

      <form onSubmit={handleUpload} className="mt-5 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Collection *" value={collection} onChange={(e) => setCollection(e.target.value)} placeholder="Botanica" />
          <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Lumina Wallcoverings" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">Catalogue PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs text-gray-600"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          <UploadCloud size={14} />
          Upload & Extract
        </button>
      </form>

      <div className="mt-8 bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 text-sm">Past imports</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Collection</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">File</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Pages</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Uploaded by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {imports.map((imp) => (
                <tr key={imp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/home-material/import/${imp.id}`} className="font-medium text-indigo-600 hover:underline text-xs">
                      {imp.collection}
                    </Link>
                    {imp.brand && <p className="text-[11px] text-gray-400">{imp.brand}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{imp.sourceFileName}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={imp.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 tabular-nums">
                    {imp.pagesProcessed}/{imp.pageCount} scanned · {imp.counts.pending ?? 0} pending review
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{imp.uploadedByUser.name}</td>
                </tr>
              ))}
              {imports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">
                    No imports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

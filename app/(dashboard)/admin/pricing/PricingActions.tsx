"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BILLING_OPERATIONS, type BillingOperation } from "@/lib/billing/types";

const OP_LABELS: Record<BillingOperation, string> = {
  metadata_extract: "Metadata Extract",
  garment_intelligence: "Garment Intelligence",
  image_gen_1k: "Image Gen (1K)",
  image_gen_2k: "Image Gen (2K)",
  vai_image_gen: "Vertex AI Image Gen",
  tryon_1k: "Try-On (1K)",
  fashion_design_analysis: "Design Analysis",
  fashion_design_gen: "Design Generation",
  voice_search: "Voice Search",
  ai_review: "AI Review",
  auto_catalog_classify: "Catalog Classify",
  auto_catalog_verify: "Catalog Verify",
};

function PriceFields({
  prices,
  onChange,
}: {
  prices: Record<string, string>;
  onChange: (op: string, val: string) => void;
}) {
  return (
    <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
      {BILLING_OPERATIONS.map((op) => (
        <div key={op} className="flex items-center justify-between gap-4">
          <label className="text-xs font-medium text-gray-600 shrink-0">
            {OP_LABELS[op]}
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">$</span>
            <input
              type="number"
              step="0.00001"
              min="0"
              value={prices[op] ?? "0"}
              onChange={(e) => onChange(op, e.target.value)}
              className="w-28 px-2 py-1.5 text-xs text-right tabular-nums border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EditPricingButton({
  configId,
  prices,
}: {
  configId: string;
  prices: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editPrices, setEditPrices] = useState<Record<string, string>>({});

  function handleOpen() {
    const initial: Record<string, string> = {};
    for (const op of BILLING_OPERATIONS) {
      initial[op] = prices[op] != null ? String(prices[op]) : "0";
    }
    setEditPrices(initial);
    setError("");
    setOpen(true);
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    try {
      const parsed: Record<string, number> = {};
      for (const [key, val] of Object.entries(editPrices)) {
        const n = parseFloat(val);
        if (isNaN(n) || n < 0) {
          setError(`Invalid price for ${key}`);
          setLoading(false);
          return;
        }
        parsed[key] = n;
      }
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: configId, prices: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Pencil size={12} />
        Edit
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Prices</DialogTitle>
            <DialogDescription>
              Update retail prices for each AI operation (USD).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <PriceFields
              prices={editPrices}
              onChange={(op, val) =>
                setEditPrices((p) => ({ ...p, [op]: val }))
              }
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AddPricingButton({
  defaultPrices,
}: {
  defaultPrices?: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});

  function handleOpen() {
    const initial: Record<string, string> = {};
    for (const op of BILLING_OPERATIONS) {
      initial[op] =
        defaultPrices?.[op] != null ? String(defaultPrices[op]) : "0";
    }
    setPrices(initial);
    setName("");
    setError("");
    setOpen(true);
  }

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      if (!name.trim()) {
        setError("Name is required");
        setLoading(false);
        return;
      }
      const parsed: Record<string, number> = {};
      for (const [key, val] of Object.entries(prices)) {
        const n = parseFloat(val);
        if (isNaN(n) || n < 0) {
          setError(`Invalid price for ${key}`);
          setLoading(false);
          return;
        }
        parsed[key] = n;
      }
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), prices: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
      >
        <Plus size={12} />
        Add Config
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Pricing Config</DialogTitle>
            <DialogDescription>
              Create a new active pricing configuration. The previous config will
              be deactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Config Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard v2"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Prices (USD per call)
              </label>
              <PriceFields
                prices={prices}
                onChange={(op, val) =>
                  setPrices((p) => ({ ...p, [op]: val }))
                }
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating..." : "Create Config"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Pencil, Trash2, Search, ImageOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  collection: string | null;
  colorName: string | null;
  colorHex: string | null;
  priceInr: number | null;
  priceUnit: string | null;
  reviewStatus: string;
  textureAssetUrl: string | null;
  material: { category: string; subtype: string; name: string } | null;
  familyId: string | null;
  description: string | null;
  finish: string | null;
  materialComposition: string | null;
  patternCategory: string | null;
  visualStyle: string | null;
  installationMethod: string | null;
  sampleAvailable: boolean | null;
  patternName: string | null;
  patternRepeatCm: number | null;
  orientation: string | null;
  dimensions: string | null;
  patternType: string;
  sheetWidthM: number | null;
  sheetHeightM: number | null;
  minWidthM: number | null;
  minHeightM: number | null;
  warrantyInfo: string | null;
  availability: string;
  materialId: string | null;
}

function ReviewBadge({ status }: { status: string }) {
  const published = status === "published";
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        published ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

function productToFormValues(p: ProductRow): ProductFormValues {
  return {
    ...EMPTY_PRODUCT_FORM_VALUES,
    materialId: p.materialId ?? "",
    familyId: p.familyId ?? "",
    name: p.name,
    sku: p.sku ?? "",
    brand: p.brand ?? "",
    collection: p.collection ?? "",
    description: p.description ?? "",
    colorName: p.colorName ?? "",
    colorHex: p.colorHex ?? "",
    finish: p.finish ?? "",
    materialComposition: p.materialComposition ?? "",
    patternCategory: p.patternCategory ?? "",
    visualStyle: p.visualStyle ?? "",
    installationMethod: p.installationMethod ?? "",
    sampleAvailable: p.sampleAvailable === true ? "true" : p.sampleAvailable === false ? "false" : "",
    patternName: p.patternName ?? "",
    patternRepeatCm: p.patternRepeatCm != null ? String(p.patternRepeatCm) : "",
    orientation: p.orientation ?? "",
    dimensions: p.dimensions ?? "",
    patternType: p.patternType,
    sheetWidthM: p.sheetWidthM != null ? String(p.sheetWidthM) : "",
    sheetHeightM: p.sheetHeightM != null ? String(p.sheetHeightM) : "",
    minWidthM: p.minWidthM != null ? String(p.minWidthM) : "",
    minHeightM: p.minHeightM != null ? String(p.minHeightM) : "",
    priceInr: p.priceInr != null ? String(p.priceInr) : "",
    priceUnit: p.priceUnit ?? "",
    warrantyInfo: p.warrantyInfo ?? "",
    availability: p.availability,
    reviewStatus: p.reviewStatus,
  };
}

function ProductDialog({
  open,
  onOpenChange,
  title,
  materials,
  families,
  initialValues,
  currentImageUrl,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  materials: MaterialOption[];
  families: FamilyOption[];
  initialValues: ProductFormValues;
  currentImageUrl?: string | null;
  onSubmit: (fd: FormData) => Promise<string | null>;
}) {
  const [values, setValues] = useState<ProductFormValues>(initialValues);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleOpenChange(v: boolean) {
    if (v) {
      setValues(initialValues);
      setFile(null);
      setError("");
    }
    onOpenChange(v);
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    const fd = productValuesToFormData(values);
    if (file) fd.set("file", file);
    const err = await onSubmit(fd);
    setLoading(false);
    if (err) setError(err);
    else onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Fields marked * are required. New products start as Draft — publish explicitly once you&apos;re happy with them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Product photo</label>
            <div className="flex items-center gap-3">
              {currentImageUrl && !file && (
                <Image src={currentImageUrl} alt="" width={56} height={56} className="rounded-lg object-cover border border-gray-200" unoptimized />
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-xs text-gray-600"
              />
            </div>
          </div>

          <ProductFormFields
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            materials={materials}
            families={families}
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsView({
  initialProducts,
  materials,
  families,
}: {
  initialProducts: ProductRow[];
  materials: MaterialOption[];
  families: FamilyOption[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});

  async function refresh() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (statusFilter) params.set("reviewStatus", statusFilter);
    const res = await fetch(`/api/admin/home-material/products?${params.toString()}`);
    const data = await res.json();
    if (res.ok) setProducts(data.products);
    router.refresh();
  }

  async function handleCreate(fd: FormData): Promise<string | null> {
    const res = await fetch("/api/admin/home-material/products", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) return data.error || "Could not create product";
    await refresh();
    return null;
  }

  async function handleEdit(id: string, fd: FormData): Promise<string | null> {
    const res = await fetch(`/api/admin/home-material/products/${id}`, { method: "PATCH", body: fd });
    const data = await res.json();
    if (!res.ok) return data.error || "Could not update product";
    await refresh();
    return null;
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError((e) => ({ ...e, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/home-material/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError((e) => ({ ...e, [id]: data.error || "Could not delete" }));
        return;
      }
      await refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Material Catalogue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Add, review, edit, and delete wallpaper catalogue products. New entries start as Draft.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          <Plus size={12} />
          Add Product
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 max-w-xs">
          <Input
            leftIcon={<Search size={14} />}
            placeholder="Search name, SKU, collection..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refresh()}
          />
        </div>
        <div className="w-44">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: "draft", label: "Draft only" },
              { value: "published", label: "Published only" },
            ]}
          />
        </div>
        <button
          onClick={refresh}
          className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Filter
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Product</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Material</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Collection</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Price</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Status</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors align-top">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {p.textureAssetUrl ? (
                        <Image src={p.textureAssetUrl} alt="" width={36} height={36} className="rounded-lg object-cover border border-gray-200" unoptimized />
                      ) : (
                        <div
                          title="No photo — can't be published"
                          className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-400"
                        >
                          <ImageOff size={14} />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-xs">{p.name}</p>
                        {p.sku && <p className="text-[11px] text-gray-400 font-mono">{p.sku}</p>}
                        {!p.textureAssetUrl && (
                          <p className="text-[10px] text-amber-600 font-medium">No photo</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{p.material?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{p.collection ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-gray-900">
                    {p.priceInr != null ? `₹${p.priceInr.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <ReviewBadge status={p.reviewStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {deleteError[p.id] && (
                      <p className="text-[10px] text-red-600 mt-1 max-w-[220px] text-right">{deleteError[p.id]}</p>
                    )}
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                    No products yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Product"
        materials={materials}
        families={families}
        initialValues={EMPTY_PRODUCT_FORM_VALUES}
        onSubmit={handleCreate}
      />

      {editing && (
        <ProductDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          title={`Edit — ${editing.name}`}
          materials={materials}
          families={families}
          initialValues={productToFormValues(editing)}
          currentImageUrl={editing.textureAssetUrl}
          onSubmit={(fd) => handleEdit(editing.id, fd)}
        />
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { Layers, Copy, ExternalLink, Pencil, Trash2, X, Loader2, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface CollectionRow {
  id: string;
  name: string;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

interface EditProduct {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  modelImageUrl: string | null;
}

export function ShopCollectionsListView({ initialCollections }: { initialCollections: CollectionRow[] }) {
  const [collections, setCollections] = useState(initialCollections);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editProducts, setEditProducts] = useState<EditProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function collectionLinkUrl(id: string) {
    return typeof window !== "undefined" ? `${window.location.origin}/shop/collections/${id}` : `/shop/collections/${id}`;
  }

  async function copyLink(id: string) {
    await navigator.clipboard.writeText(collectionLinkUrl(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this collection? Its public link will stop working. This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/shop-collections/${id}`, { method: "DELETE" });
      setCollections((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function openEdit(id: string) {
    setEditingId(id);
    setEditLoading(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/admin/shop-collections/${id}`);
      const data = await res.json();
      if (res.ok) {
        setEditName(data.collection.name);
        setEditProducts(data.products);
      } else {
        setSaveError(data.error || "Couldn't load this collection.");
      }
    } finally {
      setEditLoading(false);
    }
  }

  function closeEdit() {
    setEditingId(null);
    setEditName("");
    setEditProducts([]);
    setSaveError("");
  }

  function removeEditProduct(id: string) {
    setEditProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function saveEdit() {
    if (!editingId || !editName.trim() || editProducts.length === 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/admin/shop-collections/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), productIds: editProducts.map((p) => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Couldn't save changes.");
        return;
      }
      setCollections((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, name: data.collection.name, productCount: data.collection.productCount, updatedAt: data.collection.updatedAt } : c))
      );
      closeEdit();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
        ← Back to Shop
      </Link>

      <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900 mb-1">Shop Collections</h1>
      <p className="text-sm text-gray-500 mb-6">Admin-curated public collections built from the /shop catalogue.</p>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <Layers className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No collections yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            Go to /shop, tap &ldquo;Create Collection&rdquo;, and select the products you want to feature.
          </p>
          <Link href="/shop"><Button variant="secondary">Go to Shop</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((c) => (
            <div key={c.id} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Layers className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-400">
                  {c.productCount} product{c.productCount === 1 ? "" : "s"} · created {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => copyLink(c.id)}
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors"
                title="Copy public link"
              >
                {copiedId === c.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedId === c.id ? "Copied" : "Copy Link"}
              </button>
              <Link
                href={`/shop/collections/${c.id}`}
                target="_blank"
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View
              </Link>
              <button
                onClick={() => openEdit(c.id)}
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editingId} onOpenChange={(open) => { if (!open && !saving) closeEdit(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit collection</DialogTitle>
            <DialogDescription>Rename or remove products. To add new products, build a fresh collection from /shop.</DialogDescription>
          </DialogHeader>

          {editLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <Input
                label="Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />

              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Products ({editProducts.length})
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1">
                  {editProducts.map((p) => {
                    const img = p.thumbnailUrl || p.modelImageUrl || p.imageUrl;
                    return (
                      <div key={p.id} className="relative rounded-xl border border-gray-100 overflow-hidden">
                        <button
                          onClick={() => removeEditProduct(p.id)}
                          className="absolute top-1 right-1 z-10 h-5 w-5 rounded-full bg-white/90 flex items-center justify-center text-gray-500 hover:text-red-600 shadow-sm"
                          title="Remove from collection"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="aspect-square bg-gray-50">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt={p.title} className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div className="p-1.5">
                          <p className="text-[11px] text-gray-700 truncate">{p.title}</p>
                          <p className="text-[11px] font-semibold text-gray-900">{formatCurrency(p.price)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {editProducts.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">A collection needs at least one product.</p>
                )}
              </div>

              {saveError && <p className="text-xs text-red-600 mt-3">{saveError}</p>}

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={closeEdit} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={saveEdit} disabled={saving || !editName.trim() || editProducts.length === 0}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseJsonSafe } from "@/lib/home-material/client";

const CATEGORY_LABELS: Record<string, string> = {
  paint: "Paint",
  wallpaper: "Wallpaper",
  wall_texture: "Wall Texture",
  wall_panel: "Wall Panels",
};

type MaterialOption = { id: string; category: string; subtype: string; name: string };

/**
 * Internal test-catalogue tool (2026-09-12) — there's no retailer
 * onboarding flow yet (see docs/home-material/product/overview.md's "Not
 * in V1" list), so this is a discreet way to add real, PUBLIC demo
 * products (wallpapers, panels, veneers, whatever's needed) to exercise
 * the app's features without hand-editing scripts/seed-home-material.ts.
 *
 * Deliberately low-visibility: a small, muted, off-brand-color floating
 * button (not the Sage Studio forest-green primary style used for every
 * real customer action) — meant to be found by someone who knows it's
 * there, not stumbled into by an actual visitor. Never linked from any
 * customer-facing nav. Mounted once in app/materials/layout.tsx so it's
 * reachable from every screen in this domain.
 */
export function AddTestProductButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [name, setName] = useState("");
  const [colorHex, setColorHex] = useState("#8ea377");
  const [colorName, setColorName] = useState("");
  const [finish, setFinish] = useState("");
  const [patternName, setPatternName] = useState("");
  const [priceInr, setPriceInr] = useState("");
  const [patternType, setPatternType] = useState<"customizable" | "repeat_sheet">("customizable");
  const [sheetWidthM, setSheetWidthM] = useState("");
  const [sheetHeightM, setSheetHeightM] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || materials.length > 0) return;
    fetch("/api/home-material/materials")
      .then((res) => parseJsonSafe(res))
      .then((data) => {
        const list = (data.materials as MaterialOption[] | undefined) ?? [];
        setMaterials(list);
        if (list.length > 0) setMaterialId(list[0].id);
      })
      .catch(() => setError("Could not load material types."));
  }, [open, materials.length]);

  function resetAndClose() {
    setOpen(false);
    setName("");
    setColorName("");
    setFinish("");
    setPatternName("");
    setPriceInr("");
    setPatternType("customizable");
    setSheetWidthM("");
    setSheetHeightM("");
    setFile(null);
    setError("");
  }

  async function handleSubmit() {
    if (!materialId) {
      setError("Select a material type.");
      return;
    }
    if (!name.trim()) {
      setError("Give the product a name.");
      return;
    }
    if (patternType === "repeat_sheet" && (!sheetWidthM || !sheetHeightM)) {
      setError("A repeating pattern needs its real sheet width and height, in meters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("materialId", materialId);
      formData.append("name", name.trim());
      formData.append("colorHex", colorHex);
      if (colorName.trim()) formData.append("colorName", colorName.trim());
      if (finish.trim()) formData.append("finish", finish.trim());
      if (patternName.trim()) formData.append("patternName", patternName.trim());
      if (priceInr) formData.append("priceInr", priceInr);
      formData.append("patternType", patternType);
      if (patternType === "repeat_sheet") {
        formData.append("sheetWidthM", sheetWidthM);
        formData.append("sheetHeightM", sheetHeightM);
      }
      if (file) formData.append("file", file);

      const res = await fetch("/api/home-material/products/admin-add", { method: "POST", body: formData });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not add test product");
        return;
      }
      resetAndClose();
      router.refresh();
    } catch (err) {
      setError(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Add a test product (internal tool)"
        className="fixed bottom-4 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-400 border border-gray-200 shadow-sm transition-colors hover:text-gray-700 hover:border-gray-400"
      >
        <FlaskConical className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : resetAndClose())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a test product</DialogTitle>
            <DialogDescription>
              Internal tool — adds a real, publicly-visible catalogue product so wallpaper/panel/texture features can
              be tested with more variety. Not a retailer-facing flow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Material type</label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {materials.length === 0 && <option value="">Loading…</option>}
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {CATEGORY_LABELS[m.category] ?? m.category} — {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Product name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ivory Grasscloth Weave"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="h-10 w-12 rounded-lg border border-gray-200" />
                  <input
                    type="text"
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    placeholder="Colour name (optional)"
                    className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Price (₹/sqft, optional)</label>
                <input
                  type="number"
                  min={1}
                  value={priceInr}
                  onChange={(e) => setPriceInr(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Finish (optional)</label>
                <input
                  type="text"
                  value={finish}
                  onChange={(e) => setFinish(e.target.value)}
                  placeholder="e.g. Matte"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Pattern name (optional)</label>
                <input
                  type="text"
                  value={patternName}
                  onChange={(e) => setPatternName(e.target.value)}
                  placeholder="e.g. Herringbone"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Is this a customizable design or a repeating pattern?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPatternType("customizable")}
                  className={`text-left rounded-xl border px-3 py-2.5 text-sm ${patternType === "customizable" ? "border-indigo-500 bg-indigo-50/60 text-indigo-800" : "border-gray-200 text-gray-600"}`}
                >
                  Customizable design (scales to the wall)
                </button>
                <button
                  type="button"
                  onClick={() => setPatternType("repeat_sheet")}
                  className={`text-left rounded-xl border px-3 py-2.5 text-sm ${patternType === "repeat_sheet" ? "border-indigo-500 bg-indigo-50/60 text-indigo-800" : "border-gray-200 text-gray-600"}`}
                >
                  Repeating pattern (fixed-size sheets)
                </button>
              </div>
            </div>

            {patternType === "repeat_sheet" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Sheet width (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={sheetWidthM}
                    onChange={(e) => setSheetWidthM(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Sheet height (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={sheetHeightM}
                    onChange={(e) => setSheetHeightM(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 cursor-pointer hover:border-indigo-300 transition-colors">
              <Upload className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">{file ? file.name : "Reference photo (optional — falls back to the colour swatch)"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button className="w-full" size="lg" loading={loading} onClick={handleSubmit}>
              Add to catalogue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

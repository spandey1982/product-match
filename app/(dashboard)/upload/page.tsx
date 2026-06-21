"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, X, ArrowLeft, ImagePlus, Sparkles, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  "Saree", "Lehenga", "Blouse", "Dupatta", "Kurta",
  "Salwar", "Anarkali", "Sharara", "Palazzo",
  "Jewellery", "Footwear", "Clutch", "Handbag",
  "Suit", "Tie", "Shirt", "Other",
];

const OCCASIONS = [
  "Wedding", "Bridal", "Festive", "Party", "Casual",
  "Formal", "Office", "Traditional", "Religious", "Anniversary",
];

const STYLE_OPTIONS = [
  "Ethnic", "Boho", "Minimalist", "Traditional", "Contemporary",
  "Fusion", "Royal", "Bridal", "Casual", "Festive",
];

const GENDERS = [
  { value: "WOMEN", label: "Women" },
  { value: "MEN", label: "Men" },
  { value: "UNISEX", label: "Unisex" },
  { value: "GIRLS", label: "Girls" },
  { value: "BOYS", label: "Boys" },
];

const SEASONS = ["Spring", "Summer", "Autumn", "Winter", "All Season"];
const MATERIALS = [
  "Silk", "Cotton", "Chiffon", "Georgette", "Velvet",
  "Banarasi", "Kanjeevaram", "Linen", "Crepe", "Net",
  "Satin", "Polyester", "Organza", "Khadi", "Wool", "Gold",
];
const PATTERNS = [
  "Solid", "Floral", "Paisley", "Geometric", "Striped", "Checked",
  "Polka", "Embroidered", "Printed", "Woven", "Zari", "Bandhani",
  "Block Print", "Abstract",
];

interface AiGenObjective { id: string; label: string; description: string; }
interface AiGenModelType { id: string; label: string; thumbnailUrl: string; }
interface AiGenConfig {
  enabled: boolean;
  objectives: AiGenObjective[];
  modelTypes: AiGenModelType[];
  logoUrl: string | null;
  vertexAvailable: boolean;
  settings: {
    defaultModelType: string;
    defaultObjective: string;
    brandingEnabled: boolean;
    brandingPosition: "top-left" | "top-right";
    catalogueProvider: "auto" | "gemini" | "vertex";
  };
}

// Provider-free, purpose-led labels (shared with the try-on settings screen).
const CATALOGUE_STYLES: { id: "auto" | "gemini" | "vertex"; label: string }[] = [
  { id: "auto", label: "Automatic" },
  { id: "gemini", label: "Natural Drape" },
  { id: "vertex", label: "Sharp Fit" },
];

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  // Optional back-of-product image — improves back-profile generation only.
  const backFileRef = useRef<HTMLInputElement>(null);
  const [backImageFile, setBackImageFile] = useState<File | null>(null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [generateModel, setGenerateModel] = useState(false);

  // AI Generation options (objective + store model). Fetched once; the chooser
  // only renders when the feature flag is on. Provider names never appear here.
  const [aiGen, setAiGen] = useState<AiGenConfig | null>(null);
  const [objective, setObjective] = useState<string>("");
  // "auto" = pick the model from the product (category + gender). The concrete
  // types are manual overrides.
  const [modelType, setModelType] = useState<string>("auto");

  // Store branding for generated images (persisted immediately on change).
  const [brandingEnabled, setBrandingEnabled] = useState(true);
  const [brandingPosition, setBrandingPosition] = useState<"top-left" | "top-right">("top-right");
  const [catalogueProvider, setCatalogueProvider] = useState<"auto" | "gemini" | "vertex">("auto");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    subcategory: "",
    color: "",
    material: "",
    pattern: "",
    gender: "WOMEN",
    price: "",
    sku: "",
  });

  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/ai-generation")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AiGenConfig | null) => {
        if (!active || !data) return;
        setAiGen(data);
        setObjective(data.settings.defaultObjective);
        // Leave modelType on "auto" — the system picks per product by default.
        setBrandingEnabled(data.settings.brandingEnabled);
        setBrandingPosition(data.settings.brandingPosition);
        setCatalogueProvider(data.settings.catalogueProvider);
        setLogoUrl(data.logoUrl);
      })
      .catch(() => {/* chooser stays hidden; legacy toggle still works */});
    return () => { active = false; };
  }, []);

  // Persist a branding setting change immediately (fire-and-forget).
  function patchBranding(patch: {
    brandingEnabled?: boolean;
    brandingPosition?: string;
    catalogueProvider?: string;
  }) {
    fetch("/api/settings/ai-generation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {/* non-fatal */});
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setLogoUrl(data.logoUrl);
    } catch {
      /* non-fatal */
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    try {
      await fetch("/api/settings/logo", { method: "DELETE" });
      setLogoUrl(null);
    } catch {
      /* non-fatal */
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file)); // original for crisp preview
    setImageUrlInput("");
    const resized = await resizeImage(file);   // max 800px JPEG for upload + AI
    setImageFile(resized);
    await extractFromImage(resized);
  }

  async function extractFromImage(file: File) {
    setExtracting(true);
    setExtractError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ai/extract-product", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setExtractError(data.error || "AI extraction failed. Fill the form manually.");
        return;
      }

      const p = data.product;

      // Populate text fields — only overwrite if Gemini returned a value
      setForm((prev) => ({
        ...prev,
        title:       p.title       || prev.title,
        description: p.description || prev.description,
        category:    p.category    || prev.category,
        subcategory: p.subcategory || prev.subcategory,
        color:       p.color       || prev.color,
        material:    p.material    || prev.material,
        pattern:     p.pattern     || prev.pattern,
        gender:      p.gender      || prev.gender,
        price:       p.price       ? String(p.price) : prev.price,
      }));

      if (p.occasion?.length)  setSelectedOccasions(p.occasion);
      if (p.styleTags?.length) setSelectedStyles(p.styleTags);
      if (p.season?.length)    setSelectedSeasons(p.season);
    } catch {
      setExtractError("Could not reach AI service. Fill the form manually.");
    } finally {
      setExtracting(false);
    }
  }

  /** Resize image client-side to max 800px, convert to JPEG 85% — reduces AI token count ~10x */
  function resizeImage(file: File, maxPx = 800, quality = 0.85): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => resolve(new File([blob!], "product.jpg", { type: "image/jpeg" })),
          "image/jpeg",
          quality
        );
      };
      img.src = url;
    });
  }

  function toggleItem(
    arr: string[],
    setter: (v: string[]) => void,
    item: string
  ) {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }

  async function handleBackImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackImagePreview(URL.createObjectURL(file));
    const resized = await resizeImage(file);
    setBackImageFile(resized);
  }

  function clearBackImage() {
    setBackImageFile(null);
    setBackImagePreview(null);
    if (backFileRef.current) backFileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.title || !form.category || !form.color || !form.price) {
      setError("Title, category, color, and price are required");
      return;
    }

    setSaving(true);
    try {
      let imageUrl: string | undefined = imageUrlInput.trim() || undefined;

      if (imageFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", imageFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        setUploading(false);
        if (uploadRes.ok) {
          imageUrl = uploadData.url;
        } else {
          // Show the actual error from the server (type error, size error, etc.)
          setError(uploadData.error || "Image upload failed. Please try a different file.");
          setSaving(false);
          return;
        }
      }

      // Optional back image — best-effort; never blocks product creation.
      let backImageUrl: string | undefined;
      if (backImageFile) {
        try {
          const bfd = new FormData();
          bfd.append("file", backImageFile);
          const backRes = await fetch("/api/upload", { method: "POST", body: bfd });
          const backData = await backRes.json();
          if (backRes.ok) backImageUrl = backData.url;
        } catch {/* optional — ignore back-image upload failure */}
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price),
          colors: [form.color],
          occasion: selectedOccasions,
          styleTags: selectedStyles,
          season: selectedSeasons,
          imageUrl,
          backImageUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save product");
        return;
      }

      setSuccess(true);

      // Kick off model image generation only if the toggle is on. When the AI
      // Generation feature is enabled we pass the chosen objective + store model;
      // otherwise the body is empty and the route runs the legacy single image.
      const willGenerate = Boolean(generateModel && imageUrl);
      if (willGenerate) {
        const genBody =
          aiGen?.enabled && objective
            ? JSON.stringify({
                objective,
                // Omit when "auto" so the engine selects the model per product.
                ...(modelType && modelType !== "auto" ? { modelType } : {}),
              })
            : undefined;
        fetch(`/api/products/${data.product.id}/generate-model-image`, {
          method: "POST",
          ...(genBody
            ? { headers: { "Content-Type": "application/json" }, body: genBody }
            : {}),
        }).catch(() => {/* silent — model image is a nice-to-have */});
      }

      // Signal the detail page to poll for the model image so it appears the
      // moment generation finishes — no manual refresh needed.
      const dest = `/products/${data.product.id}${willGenerate ? "?generating=1" : ""}`;
      setTimeout(() => router.push(dest), 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-16 w-16 bg-emerald-50 rounded-3xl flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Product added!</h2>
        <p className="text-sm text-gray-500">Redirecting to product page…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Catalog
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-500" />
          Add Product
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Add metadata-rich products for better matching accuracy
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image upload */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Product Image
          </h2>

          {imagePreview ? (
            <div className="relative w-48 h-64 mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover rounded-2xl"
                onError={() => setImagePreview(null)}
              />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                  setImageUrlInput("");
                }}
                className="absolute top-2 right-2 h-7 w-7 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50 transition-colors"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-10 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-center group"
            >
              <ImagePlus className="h-8 w-8 text-gray-300 group-hover:text-indigo-400 mx-auto mb-3 transition-colors" />
              <p className="text-sm font-medium text-gray-500 group-hover:text-indigo-600">
                Click to upload image
              </p>
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · max 5MB</p>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* Divider with OR */}
          {!imageFile && (
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">or paste a URL</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          )}

          {/* External image URL fallback */}
          {!imageFile && (
            <Input
              className="mt-3"
              placeholder="https://example.com/product-image.jpg"
              value={imageUrlInput}
              onChange={(e) => {
                setImageUrlInput(e.target.value);
                setImagePreview(e.target.value || null);
              }}
            />
          )}

          {/* Optional back image — subtle enhancement; the flow works without it.
              Improves back-profile catalogue generation when provided. */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              {backImagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={backImagePreview}
                  alt="Back of product"
                  className="h-10 w-10 rounded-lg object-cover border border-gray-100 shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                  <ImagePlus className="h-4 w-4 text-gray-300" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Back image <span className="text-gray-400 font-normal">(optional)</span></p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Improves back-view generation — uses the real back instead of guessing.
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => backFileRef.current?.click()}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300"
              >
                {backImagePreview ? "Replace" : "Add"}
              </button>
              {backImagePreview && (
                <button
                  type="button"
                  onClick={clearBackImage}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:border-red-200"
                >
                  Remove
                </button>
              )}
              <input
                ref={backFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleBackImageSelect}
              />
            </div>
          </div>

          {/* Generate model image toggle — inside image card so it's immediately visible */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Generate model image</p>
              <p className="text-xs text-gray-400 mt-0.5">
                AI places your product on a model · adds time &amp; generation cost
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGenerateModel((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                generateModel ? "bg-indigo-600" : "bg-gray-200"
              }`}
              role="switch"
              aria-checked={generateModel}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  generateModel ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* AI Generation chooser — outcome-first; no provider names shown.
              Only when generation is on AND the feature flag is enabled. */}
          {generateModel && aiGen?.enabled && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
              {/* Objective */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">What do you need?</p>
                <div className="grid gap-2">
                  {aiGen.objectives.map((o) => {
                    const active = objective === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setObjective(o.id)}
                        aria-pressed={active}
                        className={`text-left rounded-2xl border p-3 transition-all ${
                          active
                            ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200"
                            : "border-gray-100 bg-white hover:border-gray-200"
                        }`}
                      >
                        <span className="text-sm font-semibold text-gray-900">{o.label}</span>
                        <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">
                          {o.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Catalogue style — only for the Catalogue objective. Store-level
                  setting; persisted immediately. Provider names never shown. */}
              {objective === "catalogue" && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Catalogue style</p>
                  <div className="flex flex-wrap gap-2">
                    {CATALOGUE_STYLES.map((s) => {
                      const active = catalogueProvider === s.id;
                      const disabled = s.id === "vertex" && !aiGen.vertexAvailable;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setCatalogueProvider(s.id);
                            patchBranding({ catalogueProvider: s.id });
                          }}
                          aria-pressed={active}
                          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                            active
                              ? "border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Automatic picks the best style per category. Choose one to override.
                  </p>
                </div>
              )}

              {/* Store model */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Model</p>
                <div className="flex flex-wrap gap-2">
                  {[{ id: "auto", label: "Auto" }, ...aiGen.modelTypes].map((m) => {
                    const active = modelType === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModelType(m.id)}
                        aria-pressed={active}
                        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                          active
                            ? "border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Auto picks the model from the product&apos;s category &amp; gender. Choose one to override.
                </p>
              </div>

              {/* Image branding — store-level; applies to all generated images */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">Image branding</p>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !brandingEnabled;
                      setBrandingEnabled(next);
                      patchBranding({ brandingEnabled: next });
                    }}
                    role="switch"
                    aria-checked={brandingEnabled}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      brandingEnabled ? "bg-indigo-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        brandingEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Adds your logo to generated images — falls back to your store name if no logo is set.
                </p>

                {brandingEnabled && (
                  <div className="mt-3 space-y-3">
                    {/* Logo upload / preview */}
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center">
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoUrl} alt="Store logo" className="h-full w-full object-contain" />
                        ) : (
                          <ImagePlus className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={logoBusy}
                          onClick={() => logoInputRef.current?.click()}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300 disabled:opacity-50"
                        >
                          {logoBusy ? "Working…" : logoUrl ? "Replace logo" : "Upload logo"}
                        </button>
                        {logoUrl && (
                          <button
                            type="button"
                            disabled={logoBusy}
                            onClick={removeLogo}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleLogoFile}
                        />
                      </div>
                    </div>

                    {/* Position */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">Position</span>
                      {(["top-left", "top-right"] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => {
                            setBrandingPosition(pos);
                            patchBranding({ brandingPosition: pos });
                          }}
                          aria-pressed={brandingPosition === pos}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                            brandingPosition === pos
                              ? "border-indigo-300 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {pos === "top-left" ? "Top left" : "Top right"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* AI extraction status */}
        {extracting && (
          <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <div className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-medium text-indigo-700">
                Analyzing image with Gemini Flash…
              </p>
              <p className="text-xs text-indigo-500 mt-0.5">
                Extracting category, color, material, occasion and more
              </p>
            </div>
          </div>
        )}

        {!extracting && extractError && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
            <Wand2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700">AI auto-fill skipped</p>
              <p className="text-xs text-amber-600 mt-0.5">{extractError}</p>
            </div>
          </div>
        )}

        {!extracting && !extractError && imageFile && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-700">
                Details auto-filled by Gemini Flash
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Review and adjust any fields below before saving
              </p>
            </div>
            <button
              type="button"
              onClick={() => extractFromImage(imageFile)}
              className="ml-auto text-xs text-emerald-700 underline underline-offset-2 hover:no-underline shrink-0"
            >
              Re-run
            </button>
          </div>
        )}

        {/* Fields — dimmed while Gemini is extracting */}
        <div className={`space-y-6 transition-opacity duration-200 ${extracting ? "opacity-50 pointer-events-none select-none" : ""}`}>

        {/* Basic info */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Basic Information</h2>

          <Input
            label="Product title *"
            placeholder="Banarasi Silk Saree in Red & Gold"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          <Textarea
            label="Description"
            placeholder="Handwoven Banarasi silk with intricate zari work..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category *"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              placeholder="Select category"
              required
            />
            <Input
              label="Subcategory"
              placeholder="e.g. Bridal Saree"
              value={form.subcategory}
              onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Primary color *"
              placeholder="e.g. Red, Maroon, Gold"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              required
            />
            <Input
              label="Price (₹) *"
              type="number"
              placeholder="12500"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
              min={0}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Material / Fabric"
              value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value })}
              options={MATERIALS.map((m) => ({ value: m, label: m }))}
              placeholder="Select material"
            />
            <Select
              label="Gender"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              options={GENDERS}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Pattern / Print"
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              options={PATTERNS.map((p) => ({ value: p, label: p }))}
              placeholder="Select pattern"
            />
          </div>

          <Input
            label="SKU (optional)"
            placeholder="SAR-0001"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
        </div>

        {/* Occasion */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Occasion</h2>
          <p className="text-xs text-gray-400 mb-4">
            Select all that apply — used for matching
          </p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((occ) => (
              <button
                key={occ}
                type="button"
                onClick={() =>
                  toggleItem(selectedOccasions, setSelectedOccasions, occ)
                }
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  selectedOccasions.includes(occ)
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {occ}
              </button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Style Tags</h2>
          <p className="text-xs text-gray-400 mb-4">
            Helps match with stylistically similar products
          </p>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() =>
                  toggleItem(selectedStyles, setSelectedStyles, style)
                }
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  selectedStyles.includes(style)
                    ? "bg-purple-600 text-white border-purple-600"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {style}
              </button>
            ))}
          </div>
          {selectedStyles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selectedStyles.map((s) => (
                <Badge key={s} variant="purple">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Season */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Season</h2>
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((season) => (
              <button
                key={season}
                type="button"
                onClick={() =>
                  toggleItem(selectedSeasons, setSelectedSeasons, season)
                }
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  selectedSeasons.includes(season)
                    ? "bg-amber-500 text-white border-amber-500"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {season}
              </button>
            ))}
          </div>
        </div>

        </div>{/* end dimmed fields wrapper */}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pb-8">
          <Link href="/catalog" className="flex-1">
            <Button variant="secondary" className="w-full" type="button">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            loading={saving}
            className="flex-1"
          >
            {uploading ? "Uploading image…" : saving ? "Saving…" : (
              <>
                <Upload className="h-4 w-4" />
                Add to Catalog
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

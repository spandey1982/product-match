"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, ArrowLeft, ImagePlus, Sparkles, Check, Wand2, Info, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { categorySlotsFor, partSlotsFor } from "@/lib/product/part-slots";
import { type BackdropOption, type BackdropValue } from "@/components/product/BackdropSelect";
import SceneModeSelect, { type BackdropSection } from "@/components/product/SceneModeSelect";
import type { ScenicValue } from "@/components/product/ScenicCollectionSelect";
import type { SceneOptionView } from "@/lib/model-gen/scenes/library";
import { DEFAULT_GENERATION_QUALITY, type GenerationQuality } from "@/lib/model-gen/quality";
import { DEFAULT_IMAGE_GEN_MODEL, type ImageGenModel } from "@/lib/model-gen/image-gen-models";
import { useGenerationStatus } from "@/components/generation/GenerationStatusProvider";
import { ObjectiveChooser } from "@/components/generation/ObjectiveChooser";
import { QualityChooser } from "@/components/generation/QualityChooser";
import { ImageGenModelChooser } from "@/components/generation/ImageGenModelChooser";
import { CastingChooser } from "@/components/generation/CastingChooser";

// Provider-gated helpers. Provider is stored on the retailer and drives every
// downstream capability (extras, casting, scene, quality) — hide UI that
// Vertex can't consume so we never mislead about what a click will do.
type CatalogueStyle = "gemini" | "vertex";
const isGeminiPath = (p: CatalogueStyle) => p === "gemini";
const isVertexPath = (p: CatalogueStyle) => p === "vertex";

const CATEGORIES = [
  "Anarkali", "Blouse", "Clutch", "Dupatta", "Fancy Dress", "Footwear",
  "Handbag", "Jeans", "Jewellery", "Kurta", "Kurti", "Lehenga", "Palazzo",
  "Saree", "Salwar", "Sharara", "Shirt", "Suit", "T-shirt", "Tie", "Trouser",
  "Waistcoat", "Other",
];

const OCCASIONS = [
  "Wedding", "Bridal", "Festive", "Party", "Casual",
  "Formal", "Office", "Traditional", "Religious", "Anniversary",
];

const STYLE_OPTIONS = [
  "Ethnic", "Boho", "Minimalist", "Traditional", "Contemporary",
  "Fusion", "Royal", "Bridal", "Casual", "Festive",
];

const SEASONS = ["Spring", "Summer", "Autumn", "Winter", "All Season"];
const MATERIALS = [
  "Silk", "Cotton/Cotton-Blend", "Chiffon", "Georgette", "Velvet",
  "Brocade", "Linen/Linen-Blend", "Crepe", "Net",
  "Satin", "Polyester", "Organza", "Khadi", "Wool", "Viscose", "Muslin",
];
const PATTERNS = [
  "Solid", "Floral", "Paisley", "Geometric", "Striped", "Checked",
  "Polka", "Embroidered", "Printed", "Woven", "Zari", "Bandhani",
  "Block Print", "Abstract",
];

interface AiGenObjective { id: string; label: string; description: string; }
interface AiGenModelType { id: string; label: string; thumbnailUrl: string; }
interface AiGenSignatureModel { id: string; name: string; faceLabel: string | null; }
interface AiGenConfig {
  enabled: boolean;
  objectives: AiGenObjective[];
  modelTypes: AiGenModelType[];
  backdrops: BackdropOption[];
  logoUrl: string | null;
  vertexAvailable: boolean;
  scenes: SceneOptionView[];
  brandPacks: { id: string; label: string }[];
  scenicEnabled: boolean;
  /** AI Casting — flag from the server. When false, hide the casting toggle. */
  castingEnabled?: boolean;
  /** Image-gen model chooser — flag from the server. When false, hide it entirely (internal testing knob, not yet shown to retailers). */
  imageGenModelChooserEnabled?: boolean;
  /** Retailer's active Signature Models; empty when castingEnabled is false. */
  signatureModels?: AiGenSignatureModel[];
  settings: {
    defaultModelType: string;
    defaultObjective: string;
    brandingEnabled: boolean;
    brandingPosition: "top-left" | "top-right";
    brandingStyle: "classic" | "glass";
    catalogueProvider: CatalogueStyle;
    quality: GenerationQuality;
    imageGenModel: ImageGenModel;
    backdrop: BackdropValue;
    scenic: ScenicValue;
  };
  imageGenModels?: { id: ImageGenModel; label: string }[];
}

// Two provider paths, retailer-facing labels only ("Premium" = Gemini's
// multi-image + prompt surface; "Economy" = Vertex VTO's structured single-
// shot surface). "Automatic" was retired — it hid capability differences.
const CATALOGUE_STYLES: {
  id: CatalogueStyle;
  label: string;
  description: string;
}[] = [
  {
    id: "gemini",
    label: "Premium",
    description: "Full metadata + multi-image. Cast the model, scenes, quality.",
  },
  {
    id: "vertex",
    label: "Economy",
    description: "One product image, one on-model output. Faster, cheaper.",
  },
];


/** Small (i) toggle that reveals a helper sentence — keeps section headers scannable at any width instead of always showing a paragraph of copy. */
function InfoNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="More information"
        className="h-4 w-4 rounded-full border border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 flex items-center justify-center shrink-0"
      >
        <Info className="h-2.5 w-2.5" />
      </button>
      {open && (
        <span className="absolute z-10 top-6 left-0 w-64 rounded-xl border border-gray-100 bg-white p-3 text-xs leading-relaxed text-gray-500 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

/**
 * One image-upload part (Main, Pallu, Border, …) as a single compact row:
 * the primary photo on the left, macro close-ups nested beside it at a
 * visibly smaller size — the size difference itself signals "these belong
 * under this label," and the macro-add control stays visible but disabled
 * until the part has its own photo, rather than disappearing outright.
 */
function PartRow({
  label, required = false, statusText, thumbSrc, locked = false,
  onThumbClick, onRemove, macroPreviews, macroLocked, onAddMacro, onRemoveMacro, cap,
}: {
  label: string;
  required?: boolean;
  statusText: string;
  thumbSrc: string | null;
  locked?: boolean;
  onThumbClick: () => void;
  onRemove?: () => void;
  macroPreviews: string[];
  macroLocked: boolean;
  onAddMacro: () => void;
  onRemoveMacro: (index: number) => void;
  cap: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 p-2.5 flex-wrap">
      <button
        type="button"
        disabled={locked}
        onClick={onThumbClick}
        className={`relative h-10 w-10 shrink-0 rounded-xl overflow-hidden border flex items-center justify-center ${
          locked ? "border-gray-100 opacity-50 cursor-not-allowed" : "border-gray-200 hover:border-indigo-300"
        } ${thumbSrc ? "bg-white" : "bg-gray-50"}`}
      >
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbSrc} alt={label} className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-4 w-4 text-gray-300" />
        )}
      </button>
      <div className="min-w-[64px]">
        <p className="text-[13px] font-semibold text-gray-800 leading-tight">
          {label} {required && <span className="text-indigo-500">*</span>}
        </p>
        <p className="text-[11px] text-gray-400">{statusText}</p>
      </div>
      {thumbSrc && onRemove && (
        <button type="button" onClick={onRemove} className="text-[11px] text-gray-400 hover:text-red-500 shrink-0">
          Remove
        </button>
      )}
      <div className="h-8 w-px bg-gray-100 shrink-0" />
      <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-[90px]">
        {macroPreviews.map((src, i) => (
          <div key={i} className="relative h-6 w-6 rounded-md overflow-hidden border border-gray-100 shrink-0 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${label} detail ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemoveMacro(i)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              aria-label={`Remove ${label} detail ${i + 1}`}
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}
        {macroPreviews.length < cap && (
          <button
            type="button"
            disabled={macroLocked}
            onClick={onAddMacro}
            title={macroLocked ? `Add the ${label.toLowerCase()} photo first` : `Add a ${label.toLowerCase()} close-up`}
            className={`h-6 w-6 rounded-md border border-dashed flex items-center justify-center shrink-0 ${
              macroLocked
                ? "border-gray-200 text-gray-300 cursor-not-allowed"
                : "border-gray-300 text-gray-400 hover:border-indigo-300 hover:text-indigo-500"
            }`}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

const MACRO_CAP = 3;
const RECENT_CATEGORIES_KEY = "pm_recent_categories";
const RECENT_CATEGORIES_SHOWN = 3;

/** Most-recently-used categories first (client-only, per-browser) — the long full list stays one dropdown away, never removed. */
function loadRecentCategories(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CATEGORIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}
function recordCategoryUse(category: string) {
  try {
    const existing = loadRecentCategories().filter((c) => c !== category);
    localStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify([category, ...existing].slice(0, 8)));
  } catch {/* localStorage unavailable — quick-chips just stay on the default set */}
}

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { startTracking, failGeneration } = useGenerationStatus();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  // Fingerprint of the last main image we extracted from — re-uploading the same
  // image skips the (paid) extraction call; a different image re-runs it.
  const [lastExtractedHash, setLastExtractedHash] = useState<string | null>(null);
  // Per-part image uploads — each category card (Main, Pallu, Border, …) has
  // one primary photo (partFiles/partPreviews, keyed by slot id) plus zero or
  // more retailer-labelled macro close-ups NESTED under that same part
  // (macroFiles/macroPreviews, keyed by slot id, or "main" for the body).
  // Nesting beats a flat "extra detail" pool: the retailer's own act of
  // adding a macro under "Pallu" tells the app exactly which part it belongs
  // to — ground truth, not a guess Garment Intelligence has to infer later.
  const partInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [partFiles, setPartFiles] = useState<Record<string, File>>({});
  const [partPreviews, setPartPreviews] = useState<Record<string, string>>({});
  const macroInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [macroFiles, setMacroFiles] = useState<Record<string, File[]>>({});
  const [macroPreviews, setMacroPreviews] = useState<Record<string, string[]>>({});
  // Economy Catalogue — back product image (separate from part-slot close-ups).
  const backFileRef = useRef<HTMLInputElement>(null);
  const [backImageFile, setBackImageFile] = useState<File | null>(null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  // Most-recently-used categories (client-only) for the quick-pick chips.
  // Hydrated post-mount deliberately, not via a lazy useState initializer —
  // localStorage isn't available during SSR, and reading it in the
  // initializer would risk a server/client hydration mismatch instead.
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentCategories(loadRecentCategories());
  }, []);

  function clearPart(slotId: string) {
    setPartFiles((prev) => { const n = { ...prev }; delete n[slotId]; return n; });
    setPartPreviews((prev) => { const n = { ...prev }; delete n[slotId]; return n; });
    setMacroFiles((prev) => { const n = { ...prev }; delete n[slotId]; return n; });
    setMacroPreviews((prev) => { const n = { ...prev }; delete n[slotId]; return n; });
  }
  async function handleMacroAdd(parentId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const resized = await resizeImage(file);
    setMacroFiles((prev) => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), resized] }));
    setMacroPreviews((prev) => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), URL.createObjectURL(file)] }));
  }
  function handleMacroRemove(parentId: string, index: number) {
    setMacroFiles((prev) => ({ ...prev, [parentId]: (prev[parentId] ?? []).filter((_, i) => i !== index) }));
    setMacroPreviews((prev) => ({ ...prev, [parentId]: (prev[parentId] ?? []).filter((_, i) => i !== index) }));
  }

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [generateModel, setGenerateModel] = useState(false);

  // AI Generation options (objective + store model). Fetched once; the chooser
  // only renders when the feature flag is on. Provider names never appear here.
  const [aiGen, setAiGen] = useState<AiGenConfig | null>(null);
  const [objective, setObjective] = useState<string>("");
  // Model is auto-selected from the product (category + detected gender) for now;
  // an explicit picker is planned. Kept in state so the gen request can pass it.
  const [modelType] = useState<string>("auto");
  // AI Casting — per-generation choice. "auto" (default) = AI Casting picks a
  // face + brief per product; a specific id = use that Signature Model. Never
  // persisted — matches the "quality" pattern (resets per product).
  // Classic = legacy reference-model path; Personalised = AI Casting with
  // Signature Models. Only meaningful on the Gemini path.
  const [modelMode, setModelMode] = useState<"classic" | "personalised">("personalised");
  const [castingSelection, setCastingSelection] = useState<string>("auto");
  // Native generation quality — now a sticky per-retailer setting, loaded
  // from /api/settings/ai-generation on mount and persisted on change via
  // patchBranding() below. Each new product starts on the retailer's
  // remembered value; the default here is only the pre-hydration seed.
  const [quality, setQuality] = useState<GenerationQuality>(DEFAULT_GENERATION_QUALITY);
  // Image-generation model — internal testing knob, sticky like `quality`.
  const [imageGenModel, setImageGenModel] = useState<ImageGenModel>(DEFAULT_IMAGE_GEN_MODEL);

  // Store branding for generated images (persisted immediately on change).
  const [brandingEnabled, setBrandingEnabled] = useState(true);
  const [brandingStyle, setBrandingStyle] = useState<"classic" | "glass">("classic");
  // Branding position is fixed to top-left (picker removed) — no state needed.
  // "Economy" (vertex) is the safe pre-hydration default: cheap, small
  // capability surface. The retailer's saved value overrides this once
  // the settings response lands in the effect below.
  const [catalogueProvider, setCatalogueProvider] = useState<CatalogueStyle>("vertex");
  // Studio backdrop (Phase 1: store-level setting only; no generation wiring yet).
  const [backdrops, setBackdrops] = useState<BackdropOption[]>([]);
  const [backdrop, setBackdrop] = useState<BackdropValue>({ mode: "smart", presetId: "reference-studio" });
  // Studio/Scenic toggle — like `quality`, a per-generation choice that always
  // resets to Studio (never persisted/restored); the scene choice UNDER
  // Scenic (`scenic` below) is still remembered between generations.
  const [backdropSection, setBackdropSection] = useState<BackdropSection>("studio");
  const [scenes, setScenes] = useState<SceneOptionView[]>([]);
  const [brandPacks, setBrandPacks] = useState<{ id: string; label: string }[]>([]);
  const [scenicEnabled, setScenicEnabled] = useState(false);
  const [scenic, setScenic] = useState<ScenicValue>({ sceneId: "wedding", intensity: "balanced", density: "classic" });
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
  const [isForRent, setIsForRent] = useState(false);
  const [rentalPricePerDay, setRentalPricePerDay] = useState("");
  const [rentalDeposit, setRentalDeposit] = useState("");

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
        setBrandingStyle(data.settings.brandingStyle ?? "classic");
        // Coerce two edge cases so the UI is always in a consistent state:
        //   • a legacy "auto" value from before the retirement of that tier
        //     collapses to Economy (matches the server-side coercion).
        //   • a saved "vertex" value on an env where Vertex is unavailable
        //     falls to Premium so the retailer can still act on the setting.
        const savedProvider = data.settings.catalogueProvider as unknown as string;
        const resolvedProvider: CatalogueStyle =
          savedProvider === "gemini" || savedProvider === "vertex"
            ? savedProvider
            : "vertex";
        setCatalogueProvider(
          resolvedProvider === "vertex" && !data.vertexAvailable ? "gemini" : resolvedProvider
        );
        if (data.settings.quality) setQuality(data.settings.quality);
        if (data.settings.imageGenModel) setImageGenModel(data.settings.imageGenModel);
        setBackdrops(data.backdrops ?? []);
        if (data.settings.backdrop) setBackdrop(data.settings.backdrop);
        setScenes(data.scenes ?? []);
        setBrandPacks(data.brandPacks ?? []);
        setScenicEnabled(Boolean(data.scenicEnabled));
        // backdropSection is intentionally NOT restored here — always starts
        // on Studio, like `quality` always starts on Standard.
        if (data.settings.scenic) setScenic(data.settings.scenic);
        setLogoUrl(data.logoUrl);
      })
      .catch(() => {/* chooser stays hidden; legacy toggle still works */});
    return () => { active = false; };
  }, []);

  // Persist a branding/generation setting change immediately (fire-and-forget).
  function patchBranding(patch: {
    brandingEnabled?: boolean;
    brandingPosition?: string;
    brandingStyle?: "classic" | "glass";
    catalogueProvider?: CatalogueStyle;
    quality?: GenerationQuality;
    imageGenModel?: ImageGenModel;
    backdrop?: BackdropValue;
    scenic?: ScenicValue;
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

  /** SHA-256 of the raw file bytes — a stable identity for the same image. */
  async function fileHash(file: File): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the SAME file still fires onChange next time.
    e.target.value = "";
    if (!file) return;
    if (!form.category) {
      setExtractError("Select a product category first, then upload the image.");
      return;
    }
    setImagePreview(URL.createObjectURL(file)); // original for crisp preview
    setImageUrlInput("");
    const resized = await resizeImage(file);   // max 1280px JPEG for upload + AI
    setImageFile(resized);

    // Skip the (paid) extraction when the SAME image is re-uploaded; only a new
    // image (even of the same product) re-runs it.
    let hash: string | null = null;
    try { hash = await fileHash(file); } catch { /* hashing unsupported — extract anyway */ }
    if (hash && hash === lastExtractedHash) return;
    if (hash) setLastExtractedHash(hash);
    await extractFromImage(resized);
  }

  async function extractFromImage(file: File) {
    setExtracting(true);
    setExtractError("");
    try {
      const fd = new FormData();
      // Extraction only needs to read attributes — send a smaller image than the
      // stored one to cut payload/tokens/latency (fewer transient failures).
      const small = await resizeImage(file, 896, 0.85);
      fd.append("file", small);
      // Pass the retailer-confirmed category so the model describes the product
      // AS that category and never reclassifies it (e.g. saree → dupatta).
      if (form.category) fd.append("category", form.category);
      const res = await fetch("/api/ai/extract-product", { method: "POST", body: fd });
      const data = await res.json();

      if (res.status === 402 || data.error === "insufficient_credits") {
        setExtractError(data.message ?? "Not enough credits. Fill the form manually or add credits.");
        return;
      }
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

  /**
   * Controlled client-side downscale to a faithful working size before upload.
   * Uses createImageBitmap's high-quality resampler (a Lanczos-class filter)
   * resampling from the FULL original held in memory — far better colour/detail
   * than a single canvas drawImage — WITHOUT uploading the original, so stored
   * size, storage cost and transit are unchanged. A big phone photo is shrunk
   * here, so it also never trips the upload size limit. Falls back to the legacy
   * canvas path on browsers without resizeQuality support.
   */
  async function resizeImage(file: File, maxPx = 1280, quality = 0.9): Promise<File> {
    try {
      const full = await createImageBitmap(file);
      const scale = Math.min(1, maxPx / Math.max(full.width, full.height));
      const w = Math.max(1, Math.round(full.width * scale));
      const h = Math.max(1, Math.round(full.height * scale));
      const resized =
        scale < 1
          ? await createImageBitmap(full, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" })
          : full;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(resized, 0, 0);
      if (resized !== full) resized.close();
      full.close();
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", quality)
      );
      if (blob) return new File([blob], "product.jpg", { type: "image/jpeg" });
    } catch {
      /* createImageBitmap / resizeQuality unsupported — fall back below */
    }
    return legacyResizeImage(file, maxPx, quality);
  }

  /** Legacy single-step canvas resize — fallback for older browsers only. */
  function legacyResizeImage(file: File, maxPx = 1280, quality = 0.9): Promise<File> {
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

  async function handlePartSelect(slotId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const resized = await resizeImage(file);
    setPartFiles((prev) => ({ ...prev, [slotId]: resized }));
    setPartPreviews((prev) => ({ ...prev, [slotId]: URL.createObjectURL(file) }));
  }

  async function handleBackImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBackImagePreview(URL.createObjectURL(file));
    const resized = await resizeImage(file);
    setBackImageFile(resized);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.title || !form.category || !form.color || !form.price) {
      setError("Title, category, color, and price are required");
      return;
    }
    if (isForRent && (!rentalPricePerDay || !rentalDeposit)) {
      setError("Rental price and deposit are required when Available for Rent is on");
      return;
    }
    // Main product image is mandatory — extraction, model-gen, matching and
    // catalog listing all depend on it. A URL in the paste field counts as a
    // main image (imageUrlInput), otherwise the retailer must upload one.
    if (!imageFile && !imageUrlInput.trim()) {
      setError("A main product image is required.");
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

      // Optional detail close-ups (extraction-only) — best-effort, never block.
      // Only uploaded on the Gemini path: Vertex's VTO surface can't consume
      // them, and the engine already drops them on that path. We still keep
      // any locally-uploaded close-ups in state so they resurface if the
      // retailer switches back to Premium mid-form.
      const partImages: { slot: string; label: string; url: string }[] = [];
      /** Upload one file and push it into partImages under (slot, label) — shared by primary part photos and nested macros. */
      async function uploadPart(file: File, slot: string, label: string) {
        try {
          const pfd = new FormData();
          pfd.append("file", file);
          const pRes = await fetch("/api/upload", { method: "POST", body: pfd });
          const pData = await pRes.json();
          if (pRes.ok) partImages.push({ slot, label, url: pData.url });
        } catch {/* optional — ignore a close-up upload failure */}
      }
      if (objective === "catalogue" && isGeminiPath(catalogueProvider)) {
        for (const slot of partSlotsFor(form.category)) {
          const file = partFiles[slot.id];
          if (file) await uploadPart(file, slot.id, slot.label);
          // Macro close-ups nested under this part — retailer-labelled ground
          // truth for which zone each detail belongs to (see part-slots.ts).
          const macros = macroFiles[slot.id] ?? [];
          for (let i = 0; i < macros.length; i++) {
            await uploadPart(macros[i], `${slot.id}-detail-${i + 1}`, `${slot.label} detail ${i + 1}`);
          }
        }
        // Macros nested under the main/body photo — no existing named slot for
        // these, so a synthetic "body-detail" id (never collides with a real slot).
        const bodyMacros = macroFiles["main"] ?? [];
        for (let i = 0; i < bodyMacros.length; i++) {
          await uploadPart(bodyMacros[i], `body-detail-${i + 1}`, `Body detail ${i + 1}`);
        }
      }

      // Economy Catalogue back image — upload and pass as backImageUrl.
      let backImageUrl: string | undefined;
      if (objective === "catalogue" && isVertexPath(catalogueProvider) && backImageFile) {
        try {
          const bfd = new FormData();
          bfd.append("file", backImageFile);
          const bRes = await fetch("/api/upload", { method: "POST", body: bfd });
          const bData = await bRes.json();
          if (bRes.ok) backImageUrl = bData.url;
        } catch {/* optional — back image upload failure won't block product creation */}
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
          isForRent,
          rentalPricePerDay: isForRent ? parseFloat(rentalPricePerDay) : undefined,
          rentalDeposit: isForRent ? parseFloat(rentalDeposit) : undefined,
          imageUrl,
          backImageUrl,
          partImages,
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
                quality,
                model: imageGenModel,
                backdropSection,
                // Omit when "auto" so the engine selects the model per product.
                ...(modelType && modelType !== "auto" ? { modelType } : {}),
                // Classic mode skips AI Casting entirely.
                useCasting: modelMode === "personalised",
                // AI Casting Signature Model — omit on "auto" so the engine
                // smart-picks; a specific id pins the retailer's saved brief.
                ...(modelMode === "personalised" && castingSelection && castingSelection !== "auto"
                  ? { signatureProfileId: castingSelection }
                  : {}),
              })
            : undefined;
        const productId = data.product.id;
        let genFailCode: string | null = null;
        const genPromise = fetch(`/api/products/${productId}/generate-model-image`, {
          method: "POST",
          ...(genBody
            ? { headers: { "Content-Type": "application/json" }, body: genBody }
            : {}),
        }).then(async (r) => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({})) as { error?: string; message?: string };
            genFailCode = body.error === "insufficient_credits" ? "credits" : "error";
            const msg = body.error === "insufficient_credits"
              ? (body.message ?? "Not enough credits. Contact your admin to add more credits.")
              : "Image generation failed. Try again from the product page.";
            failGeneration(productId, msg);
          }
        }).catch(() => {
          genFailCode = "error";
          failGeneration(productId, "Image generation failed. Try again from the product page.");
        });
        startTracking(productId);

        await Promise.race([
          genPromise,
          new Promise((r) => setTimeout(r, 1000)),
        ]);

        const q = genFailCode ? `?genFailed=${genFailCode}` : "?generating=1";
        router.push(`/products/${productId}${q}`);
      } else {
        const dest = `/products/${data.product.id}`;
        setTimeout(() => router.push(dest), 1200);
      }
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

  const slotCfg = categorySlotsFor(form.category);
  const otherSlots = slotCfg.others;
  // Quick-pick chips: most recently used categories first (client-only), a
  // sensible default set before any history exists, then the full list stays
  // one dropdown away — never removed, just not first.
  const quickCategories = (
    recentCategories.length > 0
      ? recentCategories
      : ["Saree", "Kurti", "Lehenga"]
  ).filter((c) => CATEGORIES.includes(c)).slice(0, RECENT_CATEGORIES_SHOWN);

  function selectCategory(cat: string) {
    setForm((prev) => ({ ...prev, category: cat }));
    // Different category → different detail slots; reset close-ups, macros and
    // the extraction fingerprint (the same image must re-extract under the new category).
    setPartFiles({});
    setPartPreviews({});
    setMacroFiles({});
    setMacroPreviews({});
    setLastExtractedHash(null);
    recordCategoryUse(cat);
    setRecentCategories(loadRecentCategories());
  }

  return (
    <div className="max-w-5xl mx-auto">
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

      <form onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="space-y-6 min-w-0">
        {/* Step 1 — Category first. Drives accurate AI auto-fill (no
            mis-classification) and the category-specific image guidance below. */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Product category <span className="text-indigo-500">*</span>
            </h2>
            <InfoNote text="Select this first — it's used to recognise your product correctly and guide the image analysis." />
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {quickCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => selectCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  form.category === cat
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <Select
            value={form.category}
            onChange={(e) => selectCategory(e.target.value)}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            placeholder="All categories"
            required
          />
        </div>

        {/* Step 2 — Catalogue style + generation objective. Provider and
            objective are surfaced together so the downstream cards can react. */}
        {aiGen?.enabled && (
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
          {/* Generation objective — Quick Listing or Catalogue & Social */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <h2 className="text-sm font-semibold text-gray-900">
                Catalogue style <span className="text-indigo-500">*</span>
              </h2>
              <InfoNote text="Quick Listing produces a single front shot. Catalogue & Social generates a full multi-view set." />
            </div>
            <ObjectiveChooser
              objectives={aiGen.objectives}
              value={objective}
              onChange={setObjective}
            />
          </div>

          {/* Provider — Premium (Gemini) or Economy (Vertex) — compact segmented toggle */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-xs font-medium text-gray-500">Provider</p>
              <InfoNote text="Premium unlocks casting, scenes and quality tiers. Economy is the fast, low-cost path." />
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-50 rounded-2xl">
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
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                      active ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {CATALOGUE_STYLES.find((s) => s.id === catalogueProvider)?.description}
            </p>
          </div>
        </div>
        )}

        {/* Step 3 — Product image (revealed once a category is chosen).
            Each part is one compact row: primary photo + nested macro
            close-ups beside it. Slot visibility depends on objective + provider:
            Quick Listing (any) → main only
            Catalogue + Premium → main + category parts, each with macros
            Catalogue + Economy → front + back */}
        {form.category && (
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <h2 className="text-sm font-semibold text-gray-900">
              Product Image <span className="text-indigo-500">*</span>
            </h2>
            {objective === "catalogue" && isGeminiPath(catalogueProvider) && (
              <InfoNote text="Each part is its own row. Add a macro close-up beside a part once it has a photo — sized down on purpose, and the app now knows exactly which part that detail belongs to." />
            )}
          </div>
          {objective === "catalogue" && isVertexPath(catalogueProvider) && (
            <p className="text-xs text-gray-400 mb-3">
              Upload front and back product images — each is paired with a reference model to generate the catalogue set.
            </p>
          )}
          {objective === "quick_listing" && (
            <p className="text-xs text-gray-400 mb-3">
              Upload your product image — a single on-model front shot will be generated.
            </p>
          )}

          <div className="mt-3 space-y-2">
            <PartRow
              label={slotCfg.main}
              required
              statusText={imagePreview ? "Uploaded" : "Tap to add"}
              thumbSrc={imagePreview}
              onThumbClick={() => fileRef.current?.click()}
              onRemove={imagePreview ? () => { setImageFile(null); setImagePreview(null); setImageUrlInput(""); } : undefined}
              macroPreviews={macroPreviews["main"] ?? []}
              macroLocked={!imageFile}
              onAddMacro={() => macroInputRefs.current["main"]?.click()}
              onRemoveMacro={(i) => handleMacroRemove("main", i)}
              cap={MACRO_CAP}
            />
            {objective === "catalogue" && isGeminiPath(catalogueProvider) && otherSlots.map((slot) => (
              <PartRow
                key={slot.id}
                label={slot.label}
                statusText={!imageFile ? "Add the main photo first" : partPreviews[slot.id] ? "Uploaded" : "Tap to add"}
                thumbSrc={partPreviews[slot.id] ?? null}
                locked={!imageFile}
                onThumbClick={() => partInputRefs.current[slot.id]?.click()}
                onRemove={partPreviews[slot.id] ? () => clearPart(slot.id) : undefined}
                macroPreviews={macroPreviews[slot.id] ?? []}
                macroLocked={!partFiles[slot.id]}
                onAddMacro={() => macroInputRefs.current[slot.id]?.click()}
                onRemoveMacro={(i) => handleMacroRemove(slot.id, i)}
                cap={MACRO_CAP}
              />
            ))}
          </div>

          {/* Economy back image slot — Catalogue + Economy only */}
          {objective === "catalogue" && isVertexPath(catalogueProvider) && (
            <div className="mt-3">
              <button
                type="button"
                disabled={!imageFile}
                onClick={() => backFileRef.current?.click()}
                className={`w-full flex items-center gap-3 rounded-xl border p-2 text-left transition-colors ${
                  !imageFile ? "border-gray-100 opacity-60 cursor-not-allowed" : "border-gray-200 bg-white hover:border-indigo-300"
                }`}
              >
                <div className="h-11 w-11 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                  {backImagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={backImagePreview} alt="Back" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-4 w-4 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">Back Image</p>
                  <p className="text-xs text-gray-400">
                    {!imageFile ? "Add the front photo first" : backImagePreview ? "Uploaded · tap to change" : "Tap to add back product image"}
                  </p>
                </div>
                {backImagePreview && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
              </button>
              {backImagePreview && (
                <button
                  type="button"
                  onClick={() => { setBackImageFile(null); setBackImagePreview(null); }}
                  className="mt-1.5 block text-[11px] text-gray-400 hover:text-red-500"
                >
                  Remove back image
                </button>
              )}
            </div>
          )}

          {/* Hidden file inputs — primary photo per part, plus one per part's macro-add slot. */}
          {objective === "catalogue" && isGeminiPath(catalogueProvider) && otherSlots.map((slot) => (
            <input
              key={slot.id}
              ref={(el) => { partInputRefs.current[slot.id] = el; }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handlePartSelect(slot.id, e)}
            />
          ))}
          {objective === "catalogue" && isGeminiPath(catalogueProvider) && (
            <input
              ref={(el) => { macroInputRefs.current["main"] = el; }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleMacroAdd("main", e)}
            />
          )}
          {objective === "catalogue" && isGeminiPath(catalogueProvider) && otherSlots.map((slot) => (
            <input
              key={`macro-${slot.id}`}
              ref={(el) => { macroInputRefs.current[slot.id] = el; }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleMacroAdd(slot.id, e)}
            />
          ))}
          <input
            ref={backFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleBackImageSelect}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageSelect}
          />

        </div>
        )}

        {/* Step 3 — AI auto-fill status (after the image is added) */}
        {extracting && (
          <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <div className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-medium text-indigo-700">Analyzing image with Gemini Flash…</p>
              <p className="text-xs text-indigo-500 mt-0.5">Extracting color, material, occasion and more</p>
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
              <p className="text-sm font-medium text-emerald-700">Details auto-filled by Gemini Flash</p>
              <p className="text-xs text-emerald-600 mt-0.5">Review and adjust any fields below before saving</p>
            </div>
            <button type="button" onClick={() => imageFile && extractFromImage(imageFile)} className="ml-auto text-xs text-emerald-700 underline underline-offset-2 hover:no-underline shrink-0">Re-run</button>
          </div>
        )}

        {/* Step 4 — Generate model image (revealed alongside the image card
            as soon as the retailer picks a category — no need to wait for
            an actual upload before choosing generation settings). */}
        {form.category && (
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
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
              {/* Model selection mode — Classic (legacy reference models) or
                  Personalised (AI Casting with Signature Models). Only shown
                  on Premium path (Casting doesn't apply to Vertex). */}
              {aiGen.castingEnabled && isGeminiPath(catalogueProvider) && (() => {
                const modeOptions = [
                  { id: "classic" as const, label: "Classic", desc: "Curated reference models" },
                  { id: "personalised" as const, label: "Personalised", desc: "AI Casting & Signature Models" },
                ];
                const selected = modeOptions.find((m) => m.id === modelMode);
                return (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Model selection</p>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-50 rounded-2xl">
                      {modeOptions.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setModelMode(m.id)}
                          aria-pressed={modelMode === m.id}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                            modelMode === m.id ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {selected && <p className="text-xs text-gray-400 mt-2">{selected.desc}</p>}
                  </div>
                );
              })()}

              {/* AI Casting — Signature Model chooser. Only when Personalised
                  is selected AND on the Premium (Gemini) path. */}
              {aiGen.castingEnabled && isGeminiPath(catalogueProvider) && modelMode === "personalised" && (
                <CastingChooser
                  signatureModels={aiGen.signatureModels ?? []}
                  value={castingSelection}
                  onChange={setCastingSelection}
                />
              )}

              {/* Scene (Studio / Scenic) — Premium (Gemini) Catalogue only.
                  Quick Listing doesn't consume a backdrop (uses the reference
                  model's studio as-is), and Vertex ignores the fragment
                  entirely. Studio/Scenic itself is a per-generation choice
                  (like Quality) — local state, never patched to settings;
                  only the choices UNDER each mode (backdrop preset,
                  scene/presence/detail) are saved. */}
              {objective === "catalogue" && isGeminiPath(catalogueProvider) && backdrops.length > 0 && (
                <SceneModeSelect
                  section={backdropSection}
                  onSectionChange={setBackdropSection}
                  scenicEnabled={scenicEnabled}
                  backdrops={backdrops}
                  backdropValue={backdrop}
                  onBackdropChange={(next) => {
                    setBackdrop(next);
                    patchBranding({ backdrop: next });
                  }}
                  productColor={form.color}
                  scenes={scenes}
                  brandPacks={brandPacks}
                  scenicValue={scenic}
                  onScenicChange={(next) => {
                    setScenic(next);
                    patchBranding({ scenic: next });
                  }}
                  productSignals={{
                    category: form.category,
                    color: form.color,
                    pattern: form.pattern,
                    occasion: selectedOccasions,
                    styleTags: selectedStyles,
                    season: selectedSeasons,
                  }}
                />
              )}

              {/* Generation quality — Premium (Gemini) only. Vertex has no
                  quality tiers (single output size), so the picker is hidden
                  on that path. Now a STICKY per-retailer setting: the last
                  value is remembered across products and persisted on change. */}
              {isGeminiPath(catalogueProvider) && (
                <QualityChooser
                  value={quality}
                  onChange={(q) => {
                    setQuality(q);
                    patchBranding({ quality: q });
                  }}
                />
              )}

              {/* Store-model (person) selection is automatic for now (derived
                  from the product's category + the gender detected at
                  extraction). A picker for alternative store models is planned.
                  This is a DIFFERENT axis from the image-gen test model below. */}

              {/* Image-generation model — internal testing knob, Premium
                  (Gemini) only, same gating as Quality, PLUS a separate
                  server flag so it can stay hidden from retailers until
                  there's enough test evidence to commit to exposing it. */}
              {isGeminiPath(catalogueProvider) && aiGen.imageGenModelChooserEnabled && (
                <ImageGenModelChooser
                  value={imageGenModel}
                  onChange={(m) => {
                    setImageGenModel(m);
                    patchBranding({ imageGenModel: m });
                  }}
                />
              )}

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

                    {/* Watermark style — Classic wordmark or the frosted-glass
                        chip. Always placed top-left. */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">Style</span>
                      {([
                        { id: "classic", label: "Classic" },
                        { id: "glass", label: "Glass" },
                      ] as const).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setBrandingStyle(s.id);
                            patchBranding({ brandingStyle: s.id });
                          }}
                          aria-pressed={brandingStyle === s.id}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                            brandingStyle === s.id
                              ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 ring-1 ring-purple-200"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
            <Input
              label="Subcategory"
              placeholder="e.g. Bridal Saree"
              value={form.subcategory}
              onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
            />
            <div className="flex items-end pb-2.5">
              <p className="text-xs text-gray-400">
                Category: <span className="font-medium text-gray-700">{form.category || "—"}</span> · set at the top
              </p>
            </div>
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

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Available for Rent</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  List this product on the rental marketplace alongside your regular catalog
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsForRent((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  isForRent ? "bg-indigo-600" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={isForRent}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    isForRent ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {isForRent && (
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                <Input
                  label="Rental Price (₹/day) *"
                  type="number"
                  placeholder="310"
                  value={rentalPricePerDay}
                  onChange={(e) => setRentalPricePerDay(e.target.value)}
                  required
                  min={0}
                />
                <Input
                  label="Deposit (₹) *"
                  type="number"
                  placeholder="1950"
                  value={rentalDeposit}
                  onChange={(e) => setRentalDeposit(e.target.value)}
                  required
                  min={0}
                />
              </div>
            )}
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
      </div>

      {/* Right column — a live summary of what's actually configured so far.
          Deliberately NOT a preview of the generated image: there is no
          honest way to show that without paying for a real generation. */}
      <div className="space-y-4 lg:sticky lg:top-6">
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Current configuration</p>
          <div className="flex flex-wrap gap-1.5">
            {form.category && <Badge variant="outline">{form.category}</Badge>}
            {aiGen?.enabled && (
              <Badge variant="outline">{CATALOGUE_STYLES.find((s) => s.id === catalogueProvider)?.label}</Badge>
            )}
            {aiGen?.enabled && objective && (
              <Badge variant="outline">{aiGen.objectives.find((o) => o.id === objective)?.label ?? objective}</Badge>
            )}
            {generateModel && isGeminiPath(catalogueProvider) && (
              <Badge variant="outline">{quality === "enhanced" ? "Enhanced · 2K" : "Standard · 1K"}</Badge>
            )}
            {generateModel && isGeminiPath(catalogueProvider) && aiGen?.imageGenModelChooserEnabled && (
              <Badge variant="outline">{aiGen.imageGenModels?.find((m) => m.id === imageGenModel)?.label ?? imageGenModel}</Badge>
            )}
            {!generateModel && (
              <Badge variant="outline">Generation off</Badge>
            )}
          </div>
        </div>
      </div>
      </div>
      </form>
    </div>
  );
}

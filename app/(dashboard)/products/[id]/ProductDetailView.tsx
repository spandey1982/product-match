"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Product, Recommendation } from "@/types";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { RecommendationCard } from "@/components/product/RecommendationCard";
import { ShareModelImage } from "@/components/product/ShareModelImage";
import { TryOnQueueButton } from "@/components/trial-room/TryOnQueueButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Tag,
  Palette,
  Calendar,
  IndianRupee,
  Layers,
  Trash2,
  Loader2,
  ImagePlus,
  Pencil,
  X,
  Check,
  Shirt,
  Crown,
  MoreVertical,
  Heart,
} from "lucide-react";
import { ProductImageViewer } from "@/components/product/ProductImageViewer";
import { ProductThumbnailRail } from "@/components/product/ProductThumbnailRail";
import { displayUrl, masterUrl, thumbnailUrl } from "@/lib/images/variants";
import { framedImageUrl, FULL_MODEL_VIEWS } from "@/lib/image-normalize";
import { formatLabel } from "@/lib/product-detail/format";
import { colorSwatchHex, colorDescriptor, pairingSuggestions, pairingNote } from "@/lib/product-detail/color-presentation";
import { materialDescriptor, occasionDescriptor, categoryDescriptor, styleValue } from "@/lib/product-detail/descriptors";
import { cn } from "@/lib/utils";

interface GeneratedImage {
  url: string;
  view: string;
  objective?: string;
}

interface Props {
  product: Product;
  generatedImages?: GeneratedImage[];
  /** True when arriving right after requesting model-image generation. */
  initialGenerating?: boolean;
}

type RecommendationWithProduct = Recommendation & { product: Product };

/** "pallu" → "Pallu", "front" → "Front" — a friendly label for a view id. */
function prettyView(view: string): string {
  return view
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Product Information card — icon/swatch + label + value cell ────────────

function InfoCell({
  icon: Icon,
  swatch,
  image,
  label,
  children,
}: {
  icon?: React.ElementType;
  swatch?: string;
  image?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 sm:p-3 min-w-0">
      <div className="h-8 w-8 rounded-xl shrink-0 overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : swatch ? (
          <span className="h-full w-full block" style={{ backgroundColor: swatch }} />
        ) : Icon ? (
          <Icon className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-gray-400 mb-0.5 tracking-wide font-body">{label}</p>
        {children}
      </div>
    </div>
  );
}

function FieldValue({ value, descriptor }: { value: string; descriptor?: string | null }) {
  return (
    <>
      <p className="text-sm font-semibold text-gray-900 truncate font-body">{value}</p>
      {descriptor && <p className="text-xs text-gray-400 mt-0.5 truncate font-body">{descriptor}</p>}
    </>
  );
}

function FieldRow({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("grid grid-cols-2 divide-x divide-gray-100", !last && "border-b border-gray-100")}>
      {children}
    </div>
  );
}

const editInputClass =
  "w-full border-b border-gray-200 focus:outline-none focus:border-purple-400 text-sm font-medium bg-transparent py-0.5 font-body";

// Progressive generation status shown in the hero banner while images are
// being generated — advanced on a timer, last phase holds until images land.
const GEN_PHASES = [
  "Generating model images…",
  "Adding fine details…",
  "Almost done…",
  "Final tweaks…",
  "Polishing… hang tight",
];

export function ProductDetailView({
  product,
  generatedImages = [],
  initialGenerating = false,
}: Props) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<RecommendationWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const [genImages, setGenImages] = useState<GeneratedImage[]>(generatedImages);
  const [modelUrl, setModelUrl] = useState<string | null>(product.modelImageUrl ?? null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState({
    title: product.title,
    description: product.description ?? "",
    price: String(product.price),
    color: product.color,
    material: product.material ?? "",
    subcategory: product.subcategory ?? "",
    occasion: product.occasion.join(", "),
    styleTags: product.styleTags.join(", "),
  });
  // Live display values (updated on save)
  const [displayProduct, setDisplayProduct] = useState(product);

  // Separate model images from catalogue flat images
  const modelImages: GeneratedImage[] = genImages.filter(
    (g) => g.objective === "model" || g.view === "on-model"
  );
  const catalogueImages: GeneratedImage[] = genImages.filter(
    (g) => g.objective === "catalogue" && g.view !== "on-model"
  );
  const materialCropUrl = catalogueImages.find((g) => g.view === "fabric")?.url;

  // `modelUrl` (Product.modelImageUrl) is a legacy field kept in sync with the
  // "front" ProductImage for backward compatibility (see persist.ts) — for any
  // product generated through the current card-stack pipeline, catalogueImages
  // already has that same shot as "front". Only synthesize the on-model
  // fallback when there's no such entry, otherwise it duplicates the front shot.
  const hasFrontInCatalogue = catalogueImages.some((g) => g.view === "front");
  const onModel: GeneratedImage[] =
    modelImages.length > 0
      ? modelImages
      : modelUrl && !hasFrontInCatalogue
      ? [{ url: modelUrl, view: "on-model" }]
      : [];

  const hasModelImage = onModel.length > 0 || hasFrontInCatalogue;
  const [generating, setGenerating] = useState(initialGenerating && !hasModelImage);
  // Retailer-facing generation failure message. Reserved for ABSOLUTE
  // failures only (route reported failure, network error, or the poll truly
  // exhausted) — normal long runs show progressive status, never a warning.
  const [genError, setGenError] = useState<string | null>(null);
  // Progressive status shown while generating — advances on a timer through
  // GEN_PHASES (like model-thinking indicators), staying on the last one
  // until images actually arrive. Purely cosmetic pacing: the real "done"
  // signal is the poll below / the generate request resolving. Reset happens
  // at the trigger (handleGenerateModelImage), not in the effect.
  const [genPhase, setGenPhase] = useState(0);
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(
      () => setGenPhase((p) => Math.min(p + 1, GEN_PHASES.length - 1)),
      18000
    );
    return () => clearInterval(t);
  }, [generating]);

  // Carousel order: base + part-crop images (persisted card-stack order), then
  // the retailer's raw uploaded product photo last.
  const allImages: GeneratedImage[] = [
    ...onModel,
    ...catalogueImages,
  ];
  const productImages = [...allImages.map((g) => g.url), product.imageUrl].filter(
    Boolean
  ) as string[];

  // `allImages[i]` maps 1:1 onto `productImages[i]` for i < allImages.length;
  // the final slot (when product.imageUrl is present) has no `view` — it's the
  // retailer's raw upload, not one of the generated/cropped views.
  const viewAt = (i: number): string | undefined => allImages[i]?.view;

  const BASE_ZOOM = 3;
  const CROP_ZOOM = BASE_ZOOM - 0.5;

  const framedImages = productImages.map((url, i) => framedImageUrl(url, viewAt(i)));
  const displayImages = framedImages.map(displayUrl);
  const masterImages = framedImages.map(masterUrl);
  const thumbImages = framedImages.map(thumbnailUrl);
  const imageLabels = productImages.map((_, i) => {
    const view = viewAt(i);
    if (view === undefined) return "Product";
    return view === "on-model" ? "On model" : prettyView(view);
  });
  const maxZooms = productImages.map((_, i) => {
    const view = viewAt(i);
    const isFullView = view === undefined || FULL_MODEL_VIEWS.has(view);
    return isFullView ? BASE_ZOOM : CROP_ZOOM;
  });
  // Clamp instead of an effect: safe even if the images array shrinks/grows
  // between renders (e.g. model image generation completing).
  const safeActiveIndex = Math.min(activeIndex, Math.max(displayImages.length - 1, 0));

  // ── Derived, presentation-only content for the redesigned right panel ──────
  const styleInfo = styleValue(displayProduct.styleTags);
  const badgeLabels = Array.from(
    new Set([
      ...displayProduct.occasion.slice(0, 2).map(formatLabel),
      ...(displayProduct.styleTags[0] ? [formatLabel(displayProduct.styleTags[0])] : []),
    ])
  ).slice(0, 3);
  const extraColors = displayProduct.colors.filter(
    (c) => c.toLowerCase() !== displayProduct.color.toLowerCase()
  );

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      router.push("/catalog");
      router.refresh();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function cancelEdit() {
    setEditFields({
      title: displayProduct.title,
      description: displayProduct.description ?? "",
      price: String(displayProduct.price),
      color: displayProduct.color,
      material: displayProduct.material ?? "",
      subcategory: displayProduct.subcategory ?? "",
      occasion: displayProduct.occasion.join(", "),
      styleTags: displayProduct.styleTags.join(", "),
    });
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    const split = (s: string) => s.split(",").map((v) => v.trim()).filter(Boolean);
    const body = {
      title: editFields.title.trim(),
      description: editFields.description.trim() || null,
      price: parseFloat(editFields.price) || 0,
      color: editFields.color.trim(),
      material: editFields.material.trim() || null,
      subcategory: editFields.subcategory.trim() || null,
      occasion: split(editFields.occasion),
      styleTags: split(editFields.styleTags),
    };
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json() as { product: Product };
      setDisplayProduct(data.product);
    }
    setSaving(false);
    setEditing(false);
  }

  async function handleGenerateModelImage() {
    setGenerating(true);
    setGenPhase(0);
    setGenError(null);
    try {
      // The route AWAITS generation server-side, so a successful response
      // already carries the finished images — apply them immediately instead
      // of waiting for the next poll tick.
      const res = await fetch(`/api/products/${product.id}/generate-model-image`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        failureMessage?: string;
        product?: { modelImageUrl?: string | null };
        generatedImages?: GeneratedImage[];
      };
      if (!res.ok || data.failureMessage) {
        setGenerating(false);
        setGenError(data.failureMessage ?? "Image generation didn't complete. Please try again in a few minutes.");
        return;
      }
      if (data.generatedImages) setGenImages(data.generatedImages);
      if (data.product?.modelImageUrl !== undefined) setModelUrl(data.product.modelImageUrl ?? null);
      setGenerating(false);
      setGenError(null);
      router.refresh();
    } catch {
      setGenerating(false);
      setGenError("Couldn't reach the server. Please check your connection and try again.");
    }
  }

  async function fetchRecommendations(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const url = `/api/products/${product.id}/recommendations?limit=8${
        refresh ? "&refresh=true" : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();

      const recs = (data.recommendations || []).filter(
        (r: Recommendation) => r.product
      ) as RecommendationWithProduct[];

      setRecommendations(recs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setTimeout(() => void fetchRecommendations(), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    if (!generating) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    // 100 × 3s = 5 minutes. A full catalogue run (garment-intelligence
    // analysis on first generation + two sequential base shots + reviews +
    // branding) legitimately exceeds the old 90s window — which made the poll
    // give up moments before success and never show the finished images.
    // Progressive status keeps the retailer informed meanwhile; the error
    // banner is reserved for a genuine 5-minute halt.
    const MAX_ATTEMPTS = 100;

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(`/api/products/${product.id}/model-status`);
        if (res.ok) {
          const data = (await res.json()) as {
            modelImageUrl: string | null;
            generatedImages: GeneratedImage[];
            failed?: boolean;
            failureMessage?: string | null;
          };
          const hasOnModel = data.generatedImages?.some(
            (g) => g.objective === "model" || g.view === "on-model"
          );
          const ready = hasOnModel || !!data.modelImageUrl;
          if (active && ready) {
            setGenImages(data.generatedImages ?? []);
            setModelUrl(data.modelImageUrl ?? null);
            setGenerating(false);
            setGenError(null);
            router.refresh();
            return;
          }
          // Server reports the run errored (out of credits, network, storage…)
          // — stop spinning immediately and show the specific reason instead of
          // waiting out the full poll window.
          if (active && data.failed) {
            setGenerating(false);
            setGenError(data.failureMessage ?? "Image generation didn't complete. Please try again in a few minutes.");
            return;
          }
        }
      } catch {
        // transient — keep polling
      }
      if (active) {
        if (attempts >= MAX_ATTEMPTS) {
          setGenerating(false);
          setGenError("Image generation didn't complete. Please retry from the ⋯ menu.");
        } else {
          timer = setTimeout(poll, 3000);
        }
      }
    }

    timer = setTimeout(poll, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [generating, product.id, router]);

  return (
    <div className="space-y-8">
      {/* Full-screen product image viewer */}
      {viewerIndex !== null && productImages.length > 0 && (
        <ProductImageViewer
          images={masterImages}
          labels={imageLabels}
          maxZooms={maxZooms}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {/* Back + top-right actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </Link>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={saving}
                className="gap-1.5 bg-purple-600 hover:bg-purple-700"
              >
                <Check className="h-3.5 w-3.5" /> Save Changes
              </Button>
            </>
          ) : (
            <DropdownMenu
              open={menuOpen}
              onOpenChange={(open) => {
                setMenuOpen(open);
                if (!open) setConfirmDelete(false);
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More actions"
                  className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleGenerateModelImage()} disabled={generating}>
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
                  )}
                  {generating ? "Generating…" : "Generate Model Image"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    if (!confirmDelete) e.preventDefault();
                    handleDelete();
                  }}
                  className={cn(confirmDelete ? "text-red-600 font-semibold" : "text-red-500")}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  {deleting ? "Deleting…" : confirmDelete ? "Tap again to confirm" : "Delete Product"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── Top: Image (left) + Product details (right) ── */}
      <div className="rounded-[2rem] bg-gradient-to-r from-transparent to-[#f7f4ef] p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* LEFT — Image */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col-reverse lg:flex-row gap-3">
            <ProductThumbnailRail
              images={thumbImages}
              labels={imageLabels}
              activeIndex={safeActiveIndex}
              onSelect={setActiveIndex}
              title={product.title}
              category={product.category}
            />
            <div
              className="relative rounded-3xl overflow-hidden aspect-[3/4] bg-gray-50 shadow-sm border border-gray-100 cursor-zoom-in group flex-1 min-w-0"
              onClick={() => setViewerIndex(safeActiveIndex)}
            >
              <ImageCarousel
                key={displayImages[0] ?? "no-image"}
                images={displayImages}
                labels={imageLabels}
                title={product.title}
                category={product.category}
                className="w-full h-full"
                index={safeActiveIndex}
                onIndexChange={setActiveIndex}
              />
              {generating && (
                <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-center gap-2 bg-indigo-600/90 backdrop-blur-sm text-white text-xs font-medium py-2 px-3 pointer-events-none">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {GEN_PHASES[genPhase]}
                </div>
              )}
              {!generating && genError && (
                <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 bg-amber-500/95 backdrop-blur-sm text-white text-xs font-medium py-2 px-3">
                  <span>{genError}</span>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setGenError(null)}
                    className="shrink-0 font-bold hover:opacity-70"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent p-4 z-20 pointer-events-none">
                <div className="flex items-center gap-2">
                  <Badge variant="purple" className="bg-white/90 text-indigo-700 backdrop-blur-sm">
                    {product.category}
                  </Badge>
                  {!product.inStock && <Badge variant="error">Out of Stock</Badge>}
                </div>
              </div>

              {product.modelImageUrl && (
                <div className="absolute bottom-3 right-3 z-30 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                  <ShareModelImage product={product} iconOnly />
                </div>
              )}
            </div>
          </div>

          {/* ── Action bar — under the image, spaced to roughly land at the same height as "Pairs beautifully with" ── */}
          <div
            className={cn(
              "flex items-center gap-3 mt-4",
              // Offset to match where the image itself starts once the thumbnail
              // rail (w-16 + gap-3 = 76px) sits to its left at the lg breakpoint.
              thumbImages.length >= 2 && "lg:pl-[76px]"
            )}
          >
            <div className="flex-1 min-w-0">
              <TryOnQueueButton product={product} />
            </div>
            <button
              type="button"
              onClick={() => setWishlisted((w) => !w)}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className={cn(
                "h-12 w-12 shrink-0 rounded-2xl border flex items-center justify-center transition-all active:scale-95",
                wishlisted
                  ? "border-rose-200 bg-rose-50 text-rose-500"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              )}
            >
              <Heart className={cn("h-5 w-5", wishlisted && "fill-current")} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* RIGHT — Product details */}
        <div className="flex flex-col gap-5">

          {/* Section 1 — badges, title, description, price (no card) */}
          <div className="space-y-3">
            {!editing && badgeLabels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {badgeLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50/60 px-3 py-1 text-xs font-medium text-indigo-700 font-body"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {editing ? (
              <input
                value={editFields.title}
                onChange={(e) => setEditFields((f) => ({ ...f, title: e.target.value }))}
                className="w-full font-heading text-3xl font-medium text-gray-900 border-b-2 border-purple-400 focus:outline-none bg-transparent"
              />
            ) : (
              <h1 className="font-heading text-3xl sm:text-4xl font-medium text-gray-900 leading-tight tracking-tight">
                {displayProduct.title}
              </h1>
            )}

            {editing ? (
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block font-body">Description</label>
                <textarea
                  value={editFields.description}
                  onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Product description…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none font-body"
                />
              </div>
            ) : (
              displayProduct.description && (
                <p className="text-sm text-gray-500 leading-relaxed font-body max-w-prose">
                  {displayProduct.description}
                </p>
              )
            )}

            {editing ? (
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block font-body">Price (₹)</label>
                <input
                  type="number"
                  value={editFields.price}
                  onChange={(e) => setEditFields((f) => ({ ...f, price: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 font-body"
                />
              </div>
            ) : (
              <div className="flex items-center gap-0.5 text-gray-800 pt-1">
                <IndianRupee className="h-5 w-5" strokeWidth={1.75} />
                <span className="font-body text-xl sm:text-2xl font-semibold">
                  {displayProduct.price.toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>

          {/* Section 2 — Product Information card */}
          <Card className="rounded-3xl overflow-hidden bg-white/90">
            <CardHeader className="px-4 sm:px-5 pt-3.5 pb-1">
              <CardTitle className="font-heading text-base font-medium">Product Information</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <FieldRow>
                <InfoCell
                  icon={Palette}
                  swatch={editing ? undefined : colorSwatchHex(displayProduct.color)}
                  label="Color"
                >
                  {editing ? (
                    <input
                      value={editFields.color}
                      onChange={(e) => setEditFields((f) => ({ ...f, color: e.target.value }))}
                      className={editInputClass}
                    />
                  ) : (
                    <>
                      <FieldValue
                        value={formatLabel(displayProduct.color)}
                        descriptor={colorDescriptor(displayProduct.color)}
                      />
                      {extraColors.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {extraColors.slice(0, 3).map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded-full pl-1 pr-1.5 py-0.5 font-body"
                            >
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: colorSwatchHex(c) }}
                              />
                              {formatLabel(c)}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </InfoCell>
                <InfoCell icon={Shirt} label="Category">
                  {editing ? (
                    <div className="space-y-1.5">
                      <input
                        disabled
                        value={displayProduct.category}
                        className="w-full text-sm bg-transparent text-gray-400 cursor-not-allowed font-body"
                      />
                      <input
                        value={editFields.subcategory}
                        onChange={(e) => setEditFields((f) => ({ ...f, subcategory: e.target.value }))}
                        placeholder="Subcategory"
                        className={editInputClass}
                      />
                    </div>
                  ) : (
                    <FieldValue
                      value={formatLabel(displayProduct.category)}
                      descriptor={categoryDescriptor(displayProduct.category, displayProduct.subcategory)}
                    />
                  )}
                </InfoCell>
              </FieldRow>

              <FieldRow>
                <InfoCell
                  icon={Layers}
                  image={!editing && materialCropUrl ? thumbnailUrl(materialCropUrl) : undefined}
                  label="Material"
                >
                  {editing ? (
                    <input
                      value={editFields.material}
                      onChange={(e) => setEditFields((f) => ({ ...f, material: e.target.value }))}
                      placeholder="e.g. Premium Net"
                      className={editInputClass}
                    />
                  ) : (
                    <FieldValue
                      value={displayProduct.material ? formatLabel(displayProduct.material) : "—"}
                      descriptor={materialDescriptor(displayProduct.material)}
                    />
                  )}
                </InfoCell>
                <InfoCell icon={Crown} label="Style">
                  {editing ? (
                    <input
                      value={editFields.styleTags}
                      onChange={(e) => setEditFields((f) => ({ ...f, styleTags: e.target.value }))}
                      placeholder="Bridal, Royal, Elegant"
                      className={editInputClass}
                    />
                  ) : (
                    <FieldValue value={styleInfo.value} descriptor={styleInfo.descriptor} />
                  )}
                </InfoCell>
              </FieldRow>

              <FieldRow last>
                <InfoCell icon={Tag} label="Craft / Specialty">
                  <FieldValue value={displayProduct.pattern ? formatLabel(displayProduct.pattern) : "—"} />
                </InfoCell>
                <InfoCell icon={Calendar} label="Occasions">
                  {editing ? (
                    <input
                      value={editFields.occasion}
                      onChange={(e) => setEditFields((f) => ({ ...f, occasion: e.target.value }))}
                      placeholder="Wedding, Festive"
                      className={editInputClass}
                    />
                  ) : (
                    <FieldValue
                      value={
                        displayProduct.occasion.length > 0
                          ? displayProduct.occasion.map(formatLabel).join(", ")
                          : "—"
                      }
                      descriptor={occasionDescriptor(displayProduct.occasion)}
                    />
                  )}
                </InfoCell>
              </FieldRow>
            </CardContent>
          </Card>

          {/* Section 3 — Pairs beautifully with */}
          <Card className="rounded-3xl overflow-hidden bg-white/90">
            <CardContent className="p-4 sm:p-5">
              <p className="font-heading text-base font-medium text-gray-900 mb-3">Pairs beautifully with</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <div className="flex items-start gap-4 sm:gap-5 overflow-x-auto pb-1 shrink-0">
                  {pairingSuggestions(displayProduct.color).map((c) => (
                    <div key={c.name} className="flex flex-col items-center gap-1.5 shrink-0">
                      <span
                        className="h-7 w-7 rounded-full ring-1 ring-gray-200 border-2 border-white shadow-sm"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-[11px] text-gray-500 text-center leading-tight font-body whitespace-nowrap">
                        {c.name}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block w-px self-stretch bg-gray-100" />
                <div className="flex items-start gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 sm:min-w-0 sm:flex-1">
                  <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-xs text-gray-400 leading-relaxed font-body">
                    {pairingNote(displayProduct.color)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      {/* ── Bottom: AI Matching Suggestions (full width) ── */}
      <div className="border-t border-gray-100 pt-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              AI Matching Suggestions
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Coordinated products from your catalog
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRecommendations(true)}
            loading={refreshing}
            className="gap-1.5 shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-5 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl">
          <div className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse" />
          <p className="text-xs text-indigo-700 font-medium">
            Scoring engine active · Category · Color · Occasion · Style compatibility
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/5]" />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-3xl border border-gray-100">
            <Sparkles className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-700 mb-1">No matches yet</p>
            <p className="text-xs text-gray-400 max-w-xs mb-4">
              Add more products to your catalog to generate coordination recommendations
            </p>
            <Link href="/upload">
              <Button variant="secondary" size="sm">Add Products</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {recommendations.map((rec) => (
              <RecommendationCard key={rec.productId} recommendation={rec} />
            ))}
          </div>
        )}

        {!loading && recommendations.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Ranked by weighted compatibility score · Category 40% · Color 30% · Occasion 20% · Style 10%
          </p>
        )}
      </div>
    </div>
  );
}

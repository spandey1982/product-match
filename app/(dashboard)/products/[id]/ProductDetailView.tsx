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
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Tag,
  Palette,
  Calendar,
  Package,
  IndianRupee,
  Layers,
  Trash2,
  Expand,
  Loader2,
} from "lucide-react";
import { ProductImageViewer } from "@/components/product/ProductImageViewer";
import { displayUrl, masterUrl } from "@/lib/images/variants";
import { normalizeCatalogueUrl } from "@/lib/image-normalize";

interface GeneratedImage {
  url: string;
  view: string;
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

function MetaChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 capitalize">{value}</p>
      </div>
    </div>
  );
}

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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Live model-image state — seeded from the server, updated by polling so a
  // freshly generated image appears without a manual refresh.
  const [genImages, setGenImages] = useState<GeneratedImage[]>(generatedImages);
  const [modelUrl, setModelUrl] = useState<string | null>(product.modelImageUrl ?? null);

  // On-model images: prefer the multi-view catalogue gallery; otherwise fall
  // back to the single legacy modelImageUrl so existing products are unchanged.
  const onModel: GeneratedImage[] =
    genImages.length > 0
      ? genImages
      : modelUrl
      ? [{ url: modelUrl, view: "on-model" }]
      : [];

  const hasModelImage = onModel.length > 0;
  const [generating, setGenerating] = useState(initialGenerating && !hasModelImage);

  const productImages = [product.imageUrl, ...onModel.map((g) => g.url)].filter(
    Boolean
  ) as string[];
  // Full-body model views (front/back/on-model) render on a uniform 3:4 canvas
  // so a catalogue's shots — and shots across catalogues — share one dimension.
  // The product photo and detail close-ups keep their natural aspect.
  const FULL_VIEWS = new Set(["on-model", "front", "back"]);
  const framedImages = productImages.map((url, i) =>
    i > 0 && FULL_VIEWS.has(onModel[i - 1]?.view) ? normalizeCatalogueUrl(url) : url
  );
  // Delivery variants: ~1200px for the inline carousel, upscaled+sharpened
  // master for the full-screen zoom viewer. f_auto/q_auto on both.
  const displayImages = framedImages.map(displayUrl);
  const masterImages = framedImages.map(masterUrl);
  const imageLabels = productImages.map((_, i) =>
    i === 0 ? "Product" : onModel[i - 1]?.view === "on-model" ? "On model" : prettyView(onModel[i - 1].view)
  );
  // Zoom caps: 2.5× for full shots, 2× for already-zoomed close-up crops.
  const maxZooms = productImages.map((_, i) =>
    i === 0 || FULL_VIEWS.has(onModel[i - 1]?.view) ? 2.5 : 2
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
    fetchRecommendations();
  }, [product.id]);

  // Poll for the generated model image so it appears the moment it's ready,
  // without the user needing to refresh. Stops on success or after ~90s.
  useEffect(() => {
    if (!generating) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 30 × 3s ≈ 90s

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(`/api/products/${product.id}/model-status`);
        if (res.ok) {
          const data = (await res.json()) as {
            modelImageUrl: string | null;
            generatedImages: GeneratedImage[];
          };
          const ready = data.generatedImages?.length > 0 || !!data.modelImageUrl;
          if (active && ready) {
            setGenImages(data.generatedImages ?? []);
            setModelUrl(data.modelImageUrl ?? null);
            setGenerating(false);
            router.refresh(); // resync server-rendered data
            return;
          }
        }
      } catch {
        // transient — keep polling
      }
      if (active) {
        if (attempts >= MAX_ATTEMPTS) setGenerating(false);
        else timer = setTimeout(poll, 3000);
      }
    }

    timer = setTimeout(poll, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [generating, product.id, router]);

  return (
    <div>
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

      {/* Back */}
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Catalog
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
        {/* LEFT — Product details */}
        <div className="space-y-6">
          {/* Image — click to open full-screen viewer */}
          <div
            className="relative rounded-3xl overflow-hidden aspect-[3/4] bg-gray-50 shadow-sm border border-gray-100 cursor-zoom-in group"
            onClick={() => setViewerIndex(0)}
          >
            <ImageCarousel
              images={displayImages}
              title={product.title}
              category={product.category}
              className="w-full h-full"
            />
            {/* Live generation indicator — clears itself when the image lands */}
            {generating && (
              <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-center gap-2 bg-indigo-600/90 backdrop-blur-sm text-white text-xs font-medium py-2 px-3 pointer-events-none">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating model image… appears here automatically
              </div>
            )}
            {/* Expand hint — appears on hover */}
            <div className="absolute top-3 right-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="h-7 w-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
                <Expand className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent p-4 z-20 pointer-events-none">
              <div className="flex items-center gap-2">
                <Badge variant="purple" className="bg-white/90 text-indigo-700 backdrop-blur-sm">
                  {product.category}
                </Badge>
                {!product.inStock && <Badge variant="error">Out of Stock</Badge>}
              </div>
            </div>
          </div>

          {/* Share on Instagram — only when model image exists */}
          {product.modelImageUrl && (
            <ShareModelImage product={product} />
          )}

          {/* Virtual Try-On — add to session try-on queue */}
          <TryOnQueueButton product={product} />

          {/* Product info card */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {product.title}
              </h1>
              {product.description && (
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            <div className="text-2xl font-bold text-gray-900 flex items-center gap-1">
              <IndianRupee className="h-5 w-5" />
              {product.price.toLocaleString("en-IN")}
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-2">
              <MetaChip icon={Palette} label="Color" value={product.color} />
              <MetaChip icon={Package} label="Category" value={product.category} />
              {product.material && (
                <MetaChip icon={Layers} label="Material" value={product.material} />
              )}
              {product.subcategory && (
                <MetaChip icon={Tag} label="Subcategory" value={product.subcategory} />
              )}
            </div>

            {/* Occasions */}
            {product.occasion.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Occasion
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {product.occasion.map((occ) => (
                    <Badge key={occ} variant="info" className="capitalize">
                      {occ}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Style tags */}
            {product.styleTags.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  Style
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {product.styleTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Colors */}
            {product.colors.length > 1 && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-2">Colors</p>
                <div className="flex gap-1.5">
                  {product.colors.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 capitalize"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Delete */}
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={handleDelete}
                disabled={deleting}
                onBlur={() => setConfirmDelete(false)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  confirmDelete
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "text-red-400 hover:text-red-600 hover:bg-red-50"
                }`}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting…" : confirmDelete ? "Tap again to confirm delete" : "Delete Product"}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Recommendations */}
        <div>
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

          {/* AI Engine indicator */}
          <div className="flex items-center gap-2 mb-5 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl">
            <div className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse" />
            <p className="text-xs text-indigo-700 font-medium">
              Scoring engine active · Category · Color · Occasion · Style compatibility
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/5]" />
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-3xl border border-gray-100">
              <Sparkles className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                No matches yet
              </p>
              <p className="text-xs text-gray-400 max-w-xs mb-4">
                Add more products to your catalog to generate coordination recommendations
              </p>
              <Link href="/upload">
                <Button variant="secondary" size="sm">
                  Add Products
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
    </div>
  );
}

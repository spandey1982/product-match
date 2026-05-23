"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Product, Recommendation } from "@/types";
import { ImageCarousel } from "@/components/product/ImageCarousel";
import { RecommendationCard } from "@/components/product/RecommendationCard";
import { ShareModelImage } from "@/components/product/ShareModelImage";
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
} from "lucide-react";

interface Props {
  product: Product;
}

type RecommendationWithProduct = Recommendation & { product: Product };

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

export function ProductDetailView({ product }: Props) {
  const [recommendations, setRecommendations] = useState<RecommendationWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <div>
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
          {/* Image */}
          <div className="relative rounded-3xl overflow-hidden aspect-[3/4] bg-gray-50 shadow-sm border border-gray-100">
            <ImageCarousel
              images={[product.imageUrl, product.modelImageUrl]}
              title={product.title}
              category={product.category}
              className="w-full h-full"
            />
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

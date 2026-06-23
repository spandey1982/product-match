"use client";
import Link from "next/link";
import { Product, Recommendation } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { ProductImage } from "./ProductImage";
import { thumbnailUrl } from "@/lib/images/variants";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Tag } from "lucide-react";
import { getConfidenceLabel } from "@/lib/matching-engine/confidence";

interface RecommendationCardProps {
  recommendation: Recommendation & { product: Product };
}

function MatchBar({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-400 rounded-full transition-all duration-500"
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">
        {Math.round(score * 100)}%
      </span>
    </div>
  );
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const { product, matchScore, confidence, explanation, explanationTags } =
    recommendation;
  const confidenceLabel = getConfidenceLabel(confidence);
  const matchPct = Math.round(matchScore * 100);

  const scoreColor =
    matchPct >= 75
      ? "text-emerald-600"
      : matchPct >= 55
      ? "text-amber-600"
      : "text-gray-500";

  const badgeVariant =
    matchPct >= 75 ? "success" : matchPct >= 55 ? "warning" : "default";

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all duration-200 hover:-translate-y-0.5">
        {/* Image + score overlay */}
        <div className="relative aspect-[3/4] overflow-hidden">
          <ProductImage
            src={product.imageUrl ? thumbnailUrl(product.imageUrl) : product.imageUrl}
            title={product.title}
            category={product.category}
            className="w-full h-full transition-transform duration-300 group-hover:scale-105"
          />
          {/* Match score badge */}
          <div className="absolute top-2 left-2">
            <div
              className={`flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm ${scoreColor}`}
            >
              <Sparkles className="h-3 w-3" />
              <span className="text-xs font-bold">{matchPct}%</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-2">
            <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
              {product.title}
            </h4>
            <p className="text-xs text-gray-500 capitalize mt-0.5">
              {product.category}
            </p>
          </div>

          {/* Explanation */}
          <div className="flex items-start gap-1.5 mb-3 p-2 bg-indigo-50 rounded-xl">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-700 leading-relaxed font-medium">
              {explanation}
            </p>
          </div>

          {/* Tags */}
          {explanationTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {explanationTags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 bg-gray-50 text-gray-600 text-xs rounded-full px-2 py-0.5"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Score breakdown */}
          <div className="space-y-1.5 mb-3 pt-2 border-t border-gray-50">
            <MatchBar score={recommendation.categoryScore} label="Category" />
            <MatchBar score={recommendation.colorScore} label="Color" />
            <MatchBar score={recommendation.occasionScore} label="Occasion" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <Badge variant={badgeVariant}>{confidenceLabel}</Badge>
            <span className="text-sm font-bold text-gray-900">
              {formatCurrency(product.price)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

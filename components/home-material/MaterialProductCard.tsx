"use client";
import { Button } from "@/components/ui/button";
import type { BrowseProduct } from "@/lib/home-material/browse-product";

export const CATEGORY_LABELS: Record<string, string> = {
  paint: "Paint",
  wallpaper: "Wallpaper",
  wall_texture: "Wall Texture",
  wall_panel: "Wall Panels",
};
export const CATEGORY_ORDER = ["paint", "wallpaper", "wall_texture", "wall_panel"];
export const MAINTENANCE_LABELS: Record<string, string> = {
  low: "Low maintenance",
  medium: "Some maintenance",
  high: "High maintenance",
};

export function PriceTag({ p }: { p: BrowseProduct }) {
  if (p.priceIsExact) return <span className="text-sm font-bold text-gray-900">₹{p.priceInr}<span className="font-normal text-gray-400"> /sq.ft</span></span>;
  if (p.costRangeMinInr != null && p.costRangeMaxInr != null) {
    return <span className="text-sm text-gray-500">₹{p.costRangeMinInr}–₹{p.costRangeMaxInr}<span className="text-gray-400"> /sq.ft</span></span>;
  }
  return <span className="text-sm text-gray-400">Price on request</span>;
}

/**
 * Home Material's browse card, deliberately matching /shop's
 * ShopProductCard visual language (2026-09-14 browse-parity work): same
 * rounded-2xl/border/shadow/hover-lift card shell, image-on-top +
 * name/price/CTA-button layout, same grid this renders inside
 * (grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5). Content
 * differs because the domain differs — a colour/texture swatch instead
 * of a garment photo, a durability/maintenance chip instead of a size
 * badge, "See in my room" instead of "Try & Buy" (this domain has no
 * cart/checkout in V1). Deliberately does NOT add a wishlist heart like
 * ShopProductCard's — that would need session-aware shortlist state on
 * an otherwise-anonymous landing page, out of scope for this pass.
 */
export function MaterialProductCard({ p, onOpen }: { p: BrowseProduct; onOpen: () => void }) {
  const categoryLabel = CATEGORY_LABELS[p.category ?? ""] ?? "Material";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden">
        {p.textureAssetUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.textureAssetUrl}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundColor: p.colorHex || "#e5e7eb" }}
          />
        )}
      </div>

      <div className="px-4 pb-4 pt-4 space-y-2">
        <h3
          title={p.name}
          className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2.25rem] group-hover:text-[var(--color-indigo-600)] transition-colors"
        >
          {p.name}
        </h3>

        <p className="text-[11px] text-gray-400 truncate">
          {[p.patternName, p.finish].filter(Boolean).join(" · ") || categoryLabel}
        </p>

        {(p.durabilityYearsApprox != null || p.maintenanceLevel) && (
          <div className="flex flex-wrap gap-1.5">
            {p.durabilityYearsApprox != null && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">~{p.durabilityYearsApprox}yr durability</span>
            )}
            {p.maintenanceLevel && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{MAINTENANCE_LABELS[p.maintenanceLevel] ?? p.maintenanceLevel}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          {p.colorHex && (
            <span className="h-3.5 w-3.5 rounded-full ring-1 ring-gray-200 shrink-0" style={{ backgroundColor: p.colorHex }} />
          )}
          <PriceTag p={p} />
        </div>

        <Button size="sm" className="w-full mt-1" tabIndex={-1}>
          See in my room
        </Button>
      </div>
    </button>
  );
}

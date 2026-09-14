"use client";
import { Eye } from "lucide-react";
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
 * name/price layout, same grid this renders inside (grid-cols-2
 * sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5). Content differs because
 * the domain differs — a colour/texture swatch instead of a garment
 * photo, a durability/maintenance chip instead of a size badge.
 *
 * The action button (2026-09-15) mirrors components/catalog/ProductCard.tsx's
 * TryOnCardButton placement exactly: a circular icon straddling the
 * image/info boundary (`right-3 bottom-0 translate-y-1/2`), not a
 * full-width text button — same "right edge, half in the photo, half in
 * the info strip" convention used across /shop, /rent, and the retailer
 * catalog. An eye icon since the actual action here is "see this on your
 * wall," not "try on"/"buy" — there's no cart/checkout in this domain's
 * V1, so borrowing that button's literal label would misdescribe what it
 * does. Purely a presentational echo of the card's own onClick (tabIndex
 * -1, not an independent tab stop) — clicking anywhere on the card does
 * the same thing, same as the full-width button it replaces did.
 * Deliberately does NOT add a wishlist heart like ShopProductCard's —
 * that would need session-aware shortlist state on an otherwise-
 * anonymous landing page, out of scope for this pass.
 */
export function MaterialProductCard({ p, onOpen }: { p: BrowseProduct; onOpen: () => void }) {
  const categoryLabel = CATEGORY_LABELS[p.category ?? ""] ?? "Material";
  return (
    // A <div role="button">, not a <button> — it wraps a real <Button>
    // below ("See in my room"), and HTML forbids nesting <button> inside
    // <button> (invalid markup the browser silently "fixes" by breaking
    // out of the outer element, which is what was blowing up the card
    // layout into oversized, mis-rendered blocks — confirmed via Next.js's
    // own dev-mode error overlay, not just guessed). onKeyDown keeps it
    // keyboard-activatable (Enter/Space) since a div has no built-in
    // button semantics.
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group text-left rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
    >
      {/* No overflow-hidden here (unlike the outer card) — it would clip
          the eye button below, which deliberately protrudes past the
          image into the info strip. The outer card's own overflow-hidden
          still keeps everything within the card's rounded corners. */}
      <div className="relative aspect-[3/4]">
        <div className="absolute inset-0 overflow-hidden bg-gray-50">
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

        <div className="absolute right-3 bottom-0 translate-y-1/2 z-20">
          <span
            tabIndex={-1}
            title="See on your wall"
            aria-hidden="true"
            className="h-9 w-9 rounded-full flex items-center justify-center bg-gradient-to-br from-[var(--color-indigo-500)] to-[var(--color-indigo-700)] text-white shadow-md transition-transform group-hover:scale-105"
          >
            <Eye size={16} />
          </span>
        </div>
      </div>

      {/* pt-6, not pt-4 — gives the overlapping eye button room to breathe, matching components/catalog/ProductCard.tsx's identical convention. */}
      <div className="px-4 pb-4 pt-6 space-y-2">
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
      </div>
    </div>
  );
}

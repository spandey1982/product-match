"use client";

/**
 * Marketing Studio's nav — Client Component, not because of any real
 * client interactivity beyond reading the URL, but because that's exactly
 * the point: it reads the CURRENT `productId` search param (via
 * useSearchParams) and appends it to every link it renders, including
 * Gallery's. Since every screen in this section renders through this same
 * nav, a product selected on one screen round-trips through any detour to
 * another and back — no sessionStorage, no context provider, no new state
 * layer (CLAUDE.md's state-management policy rules those out; this is
 * pure URL state, the same mechanism presenter-reel/page.tsx and
 * creative/page.tsx already use to read their own productId).
 *
 * This also gives the "reset once you leave Marketing Studio" behavior
 * for free: the moment the user navigates to an unrelated section, that
 * URL has no productId to carry, so landing back here later starts clean.
 *
 * Renders BOTH the desktop sidebar and the mobile tab strip from the same
 * NAV_ITEMS/href logic — two presentations of the same links, not two
 * separate sources of truth.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Video, LayoutGrid, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/assets/marketing-studio/presenter-reel", label: "Presenter Reel", Icon: Video },
  { href: "/assets/marketing-studio/creative", label: "Marketing Creative", Icon: ImageIcon },
  { href: "/assets/marketing-studio/gallery", label: "Gallery", Icon: LayoutGrid },
  // Future tools get a new row here, not a new hub.
];

export function MarketingStudioNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId");

  function hrefFor(base: string): string {
    return productId ? `${base}?productId=${encodeURIComponent(productId)}` : base;
  }

  return (
    <>
      {/* Desktop — permanent left sidebar */}
      <nav className="hidden md:block space-y-1">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={hrefFor(href)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile — horizontal scrollable tab strip */}
      <nav className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={hrefFor(href)}
              className={cn(
                "flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors border",
                active ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "text-gray-600 border-gray-200 bg-white"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

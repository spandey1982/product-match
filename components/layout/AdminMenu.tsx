"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Shield, Tag, ClipboardCheck, Scale, Wallet, Shirt, Activity, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_LINKS = [
  { href: "/admin/usage", label: "AI Usage & Cost", icon: Activity },
  { href: "/admin/wallets", label: "Wallet Management", icon: Wallet },
  { href: "/admin/pricing", label: "Pricing Config", icon: Tag },
  { href: "/admin/billing-comparison", label: "Billing Comparison", icon: Scale },
  { href: "/admin/review", label: "Generation Review", icon: ClipboardCheck },
  { href: "/admin/garment-intelligence", label: "Garment Intelligence", icon: Shirt },
  { href: "/admin/trial-requests", label: "Home Trial Requests", icon: HeartHandshake },
];

/**
 * Icon-only quick-access dropdown to every internal /admin/* page — those
 * pages have no shared nav of their own (each just self-gates with
 * isAdmin()/notFound()), so admins previously had to remember URLs by hand.
 * Rendered only when the signed-in retailer session is admin (Navbar passes
 * isAdmin down from (dashboard)/layout.tsx's getSession()) — invisible to
 * regular retailers, same posture as the pages it links to.
 */
export function AdminMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Admin pages"
        title="Admin pages"
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
          open ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"
        )}
      >
        <Shield className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 p-1 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Admin
          </div>
          {ADMIN_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Icon className="h-4 w-4 text-indigo-400" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

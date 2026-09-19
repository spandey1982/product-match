"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Layers, Image, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/home-material/products", label: "Material Catalogue", icon: Image },
  { href: "/admin/home-material/import", label: "Catalogue PDF Import", icon: FileUp },
];

/**
 * The below-admin counterpart to AdminMenu — shown to a session holding
 * only the HM_CATALOGUE_MANAGER role (lib/auth.ts), never a full admin
 * (those see AdminMenu instead, which already includes these same two
 * links plus the staff-access page). Deliberately excludes the staff
 * page: a catalogue manager can never grant/revoke this role, only a
 * real ADMIN can (see app/api/admin/home-material/staff/route.ts).
 */
export function HmCatalogueMenu() {
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
        aria-label="Catalogue pages"
        title="Catalogue pages"
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
          open ? "text-indigo-600 bg-indigo-50" : "text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"
        )}
      >
        <Layers className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 p-1 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Catalogue
          </div>
          {LINKS.map(({ href, label, icon: Icon }) => (
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

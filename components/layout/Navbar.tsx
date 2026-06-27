"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Sparkles,
  Package,
  Upload,
  Search,
  LogOut,
  ChevronDown,
  Store,
  Heart,
  Settings,
} from "lucide-react";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";
import { cn } from "@/lib/utils";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";

interface NavbarProps {
  user: { name: string; email: string; storeName?: string | null };
}

// ─── Badge chip ───────────────────────────────────────────────────────────────

function NavBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Read live counts from session context — zero-cost when trial room is idle
  const { tryOns, wishlist } = useTrialRoom();
  const tryOnCount = tryOns.length;
  const wishlistCount = wishlist.length;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navItems = [
    { href: "/catalog", label: "Catalog", icon: Package, badge: 0 },
    { href: "/upload", label: "Add Product", icon: Upload, badge: 0 },
    { href: "/my-try-ons", label: "My Try-Ons", icon: HangerPlusIcon, badge: tryOnCount },
    { href: "/wishlist", label: "Wishlist", icon: Heart, badge: wishlistCount },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/catalog" className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm hidden sm:block">
            Mentis
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          {navItems.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:block">{label}</span>
              <NavBadge count={badge} />
            </Link>
          ))}
        </nav>

        {/* Search + user */}
        <div className="flex items-center gap-2">
          <Link
            href="/catalog"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:block text-xs">Search catalog</span>
          </Link>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                {user.name[0].toUpperCase()}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 p-1 overflow-hidden">
                  <div className="px-3 py-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user.name}
                    </p>
                    {user.storeName && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Store className="h-3 w-3" />
                        {user.storeName}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="h-px bg-gray-100 mx-1 my-1" />
                  {/* Trial Room shortcut */}
                  <Link
                    href="/trial-room"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <HangerPlusIcon className="h-4 w-4 text-indigo-400" />
                    Virtual Trial Room
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-gray-400" />
                    Settings
                  </Link>
                  <div className="h-px bg-gray-100 mx-1 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

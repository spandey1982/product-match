"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Sparkles,
  Package,
  Bot,
  FolderOpen,
  Search,
  LogOut,
  ChevronDown,
  Store,
  Heart,
  Settings,
  CreditCard,
  Wand2,
} from "lucide-react";
import { HangerPlusIcon } from "@/components/icons/HangerPlusIcon";
import { TagPlusIcon } from "@/components/icons/TagPlusIcon";
import { BusinessTypeIcon } from "@/components/shared/BusinessTypeIcon";
import { businessTypeLabel } from "@/lib/business-type";
import { cn } from "@/lib/utils";
import { useTrialRoom } from "@/components/trial-room/TrialRoomProvider";
import {
  useCreditBalance,
  CreditBalanceRing,
  CreditBalanceDropdown,
} from "@/components/billing/CreditBalance";
import { AdminMenu } from "@/components/layout/AdminMenu";
import { ALL_MODULES, type ModuleKey } from "@/lib/client-modules";

interface NavbarProps {
  user: { name: string; email: string; storeName?: string | null; businessType?: string };
  isAdmin?: boolean;
  /** Modules this account can see — every module for a default (unrestricted) account. */
  enabledModules?: ModuleKey[];
  /** Module promoted to a top-level nav slot when it isn't one of the base four already. */
  primaryModule?: ModuleKey | null;
  /** Overrides the "Mentis" wordmark for a white-labeled client. */
  brandName?: string | null;
  /** Retailer/client logo, rendered in place of the default Sparkles mark when set. */
  logoUrl?: string | null;
}

// Base nav, unchanged from today's shape/order — this is exactly what every
// existing (unrestricted) account continues to see, filtered by module.
const BASE_NAV: { key: ModuleKey; href: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "catalog", href: "/catalog", label: "Catalog", icon: Package },
  { key: "upload", href: "/upload", label: "Add Product", icon: TagPlusIcon },
  { key: "trial-room", href: "/trial-room", label: "Virtual Trial Room", icon: HangerPlusIcon },
  { key: "wishlist", href: "/wishlist", label: "Wishlist", icon: Heart },
];

// Modules that can be promoted into the top-level nav (right after Catalog)
// when a ClientProfile names them as primaryModule — never shown otherwise,
// so a default account's nav never gains a new item.
const PROMOTABLE_NAV: Partial<Record<ModuleKey, { href: string; label: string; icon: ComponentType<{ className?: string }> }>> = {
  "design-studio": { href: "/fashion-designer", label: "Design Studio", icon: Wand2 },
};

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

export function Navbar({
  user,
  isAdmin,
  enabledModules,
  primaryModule,
  brandName,
  logoUrl,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { tryOns, wishlist } = useTrialRoom();
  const tryOnCount = tryOns.length;
  const wishlistCount = wishlist.length;

  const creditBalance = useCreditBalance();

  const modules = enabledModules ?? [...ALL_MODULES];
  const isEnabled = (m: ModuleKey) => modules.includes(m);
  const showAssetsMenu =
    isEnabled("model-studio") || (isEnabled("design-studio") && primaryModule !== "design-studio");

  useEffect(() => {
    if (!userMenuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const badgeFor = (key: ModuleKey) =>
    key === "trial-room" ? tryOnCount : key === "wishlist" ? wishlistCount : 0;

  let navItems = BASE_NAV.filter((i) => isEnabled(i.key)).map((i) => ({ ...i, badge: badgeFor(i.key) }));

  // Promote primaryModule into the top-level nav (right after Catalog) when
  // it isn't already one of the base four — this is the only way a nav item
  // can appear that a default account doesn't already have.
  if (primaryModule && PROMOTABLE_NAV[primaryModule] && !BASE_NAV.some((b) => b.key === primaryModule)) {
    const promoted = { key: primaryModule, ...PROMOTABLE_NAV[primaryModule]!, badge: 0 };
    const insertAt = navItems.findIndex((i) => i.key === "catalog") + 1;
    navItems = [...navItems.slice(0, insertAt), promoted, ...navItems.slice(insertAt)];
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/catalog" className="flex items-center gap-2 shrink-0">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={brandName ?? "Logo"}
              width={32}
              height={32}
              className="h-8 w-8 rounded-xl object-cover"
              unoptimized
            />
          ) : (
            <div
              className="h-8 w-8 flex items-center justify-center"
              style={{
                borderRadius: "var(--brand-radius, 0.75rem)",
                background: "linear-gradient(to bottom right, var(--brand-primary, #6366f1), var(--brand-primary-end, #9333ea))",
              }}
            >
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          )}
          <span className="font-bold text-gray-900 text-sm hidden sm:block">
            {brandName || "Mentis"}
          </span>
          {!brandName ? (
            <span className="hidden sm:inline-flex sm:items-center px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-700 uppercase tracking-wide leading-none">
              Pilot
            </span>
          ) : (
            <span className="hidden sm:inline-flex sm:items-center text-[10px] font-medium text-gray-400 leading-none">
              Powered by Mentis
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "text-[color:var(--brand-primary,#4338ca)]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
                style={active ? { background: "color-mix(in srgb, var(--brand-primary, #6366f1) 10%, white)" } : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:block">{label}</span>
                <NavBadge count={badge} />
              </Link>
            );
          })}
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

          {isAdmin && <AdminMenu />}

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <CreditBalanceRing balance={creditBalance}>
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{
                    background: "linear-gradient(to bottom right, var(--brand-primary, #818cf8), var(--brand-primary-end, #a855f7))",
                  }}
                >
                  {user.name[0].toUpperCase()}
                </div>
              </CreditBalanceRing>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 p-1 overflow-hidden">
                <div className="px-3 py-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user.name}
                    </p>
                    {user.businessType && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full shrink-0">
                        <BusinessTypeIcon type={user.businessType} className="h-2.5 w-2.5" />
                        {businessTypeLabel(user.businessType)}
                      </span>
                    )}
                  </div>
                  {user.storeName && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Store className="h-3 w-3" />
                      {user.storeName}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <CreditBalanceDropdown balance={creditBalance} />
                {(isEnabled("auto-catalog") || showAssetsMenu) && (
                  <div className="h-px bg-gray-100 mx-1 my-1" />
                )}
                {isEnabled("auto-catalog") && (
                  <Link
                    href="/auto-catalog"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Bot className="h-4 w-4 text-indigo-400" />
                    Autonomous Catalog
                  </Link>
                )}
                {showAssetsMenu && (
                  <Link
                    href="/assets"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FolderOpen className="h-4 w-4 text-indigo-400" />
                    Assets
                  </Link>
                )}
                <Link
                  href="/billing"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <CreditCard className="h-4 w-4 text-indigo-400" />
                  Billing
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
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { Palette, BookOpen, Heart } from "lucide-react";
import { getHmUserSession } from "@/lib/home-material/auth";
import { db } from "@/lib/db";

/**
 * Persistent top nav for every /materials/* screen (2026-09-14,
 * user-requested — previously flagged as "not yet built" in
 * docs/home-material/ui/decisions.md). Mirrors components/layout/
 * ShopHeader.tsx's exact shape (brand mark left, icon links right, sticky/
 * blurred) rather than inventing a new pattern, restyled to this domain's
 * Sage Studio palette instead of the fashion side's indigo/purple.
 *
 * Deliberately uses `getHmUserSession()` (read-only) here, NOT
 * `getOrCreateHmUserSession()` — this bar renders on every single page
 * view including anonymous/crawler traffic, and provisioning a real guest
 * HmUser row just to check a shortlist count nobody asked for would create
 * junk accounts for every visitor who never otherwise interacts. A visitor
 * with no session yet simply sees the heart with no count, same as a
 * signed-out ShopHeader.
 */
export async function HmNavBar() {
  const session = await getHmUserSession();
  const shortlistCount = session
    ? await db.hmShortlistItem.count({ where: { hmUserId: session.id } })
    : 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--color-gray-100)] bg-white/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/materials" className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[var(--color-indigo-500)] to-[var(--color-indigo-700)] flex items-center justify-center">
            <Palette className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <span className="font-bold text-gray-900 text-sm">Mentis</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/materials/guide"
            aria-label="Material guide"
            title="Material guide"
            className="h-9 w-9 rounded-full flex items-center justify-center text-gray-500 hover:text-[var(--color-indigo-600)] hover:bg-[var(--color-indigo-50)] transition-colors"
          >
            <BookOpen className="h-4 w-4" strokeWidth={1.75} />
          </Link>
          <Link
            href="/materials/shortlist"
            aria-label="Shortlist"
            title="Shortlist"
            className="relative h-9 w-9 rounded-full flex items-center justify-center text-gray-500 hover:text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <Heart className="h-4 w-4" strokeWidth={1.75} />
            {shortlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-0.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {shortlistCount > 99 ? "99+" : shortlistCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}

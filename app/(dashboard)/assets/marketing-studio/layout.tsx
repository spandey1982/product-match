import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEnabledModules } from "@/lib/client-modules-server";
import { MarketingStudioNav } from "./MarketingStudioNav";

/**
 * Marketing Studio shell — a nav frame around whichever marketing/ad tool
 * is active, not a single-purpose page the way assets/model-studio is.
 * Deliberately built for more than one tool from day one — Presenter Reel,
 * Marketing Creative, and Gallery today, future tools get a new row in
 * MarketingStudioNav.tsx, not a new hub.
 *
 * Below md: a horizontal scrollable tab strip instead of a permanent
 * sidebar — the fixed two-column layout this replaced (flex gap-8 + a
 * hardcoded w-56 aside, no breakpoint at all) was confirmed the root cause
 * of a real mobile-layout break (2026-09-25): it rendered unconditionally
 * at any viewport width, crushing the header and running description text
 * off-screen on a phone. MarketingStudioNav renders both presentations
 * from one shared link list.
 *
 * Same 404-for-disabled-module gating convention as
 * assets/model-studio/layout.tsx.
 */
export default async function MarketingStudioLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) notFound();

  const modules = await getEnabledModules(session.id);
  if (!modules.includes("marketing-studio")) notFound();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row gap-4 md:gap-8">
      <aside className="md:w-56 shrink-0">
        <h2 className="hidden md:block text-lg font-bold text-gray-900 mb-4">Marketing Studio</h2>
        <MarketingStudioNav />
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

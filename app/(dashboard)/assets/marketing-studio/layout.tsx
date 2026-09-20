import { notFound } from "next/navigation";
import Link from "next/link";
import { Video, LayoutGrid } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getEnabledModules } from "@/lib/client-modules-server";

/**
 * Marketing Studio shell — a left-nav frame around whichever marketing/ad
 * tool is active, not a single-purpose page the way assets/model-studio is.
 * Deliberately built for more than one tool from day one: Presenter Reel is
 * the only entry today, but the point of this hub (per the product
 * decision that created it) is to hold future tools — an Instagram-post
 * image generator, etc. — as sibling nav items, not a rename later.
 *
 * Same 404-for-disabled-module gating convention as
 * assets/model-studio/layout.tsx.
 */
const NAV_ITEMS = [
  { href: "/assets/marketing-studio/presenter-reel", label: "Presenter Reel", Icon: Video },
  { href: "/assets/marketing-studio/gallery", label: "Gallery", Icon: LayoutGrid },
  // Future tools (e.g. Instagram post generation) get a new row here, not a new hub.
];

export default async function MarketingStudioLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) notFound();

  const modules = await getEnabledModules(session.id);
  if (!modules.includes("marketing-studio")) notFound();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
      <aside className="w-56 shrink-0">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Marketing Studio</h2>
        <nav className="space-y-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

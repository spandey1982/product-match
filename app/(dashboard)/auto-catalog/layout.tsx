import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEnabledModules } from "@/lib/client-modules-server";

/** 404s for accounts whose ClientProfile excludes "auto-catalog" — same convention as app/(dashboard)/admin/* pages. */
export default async function AutoCatalogLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) notFound();

  const modules = await getEnabledModules(session.id);
  if (!modules.includes("auto-catalog")) notFound();

  return <>{children}</>;
}

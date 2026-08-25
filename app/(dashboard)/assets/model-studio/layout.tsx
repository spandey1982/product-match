import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEnabledModules } from "@/lib/client-modules-server";

/** 404s for accounts whose ClientProfile excludes "model-studio" — same convention as app/(dashboard)/admin/* pages. */
export default async function ModelStudioLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) notFound();

  const modules = await getEnabledModules(session.id);
  if (!modules.includes("model-studio")) notFound();

  return <>{children}</>;
}

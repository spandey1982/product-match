import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEnabledModules } from "@/lib/client-modules-server";

/** 404s for accounts whose ClientProfile excludes "upload" — same convention as app/(dashboard)/admin/* pages. */
export default async function UploadLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) notFound();

  const modules = await getEnabledModules(session.id);
  if (!modules.includes("upload")) notFound();

  return <>{children}</>;
}

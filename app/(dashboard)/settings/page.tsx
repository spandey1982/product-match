import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { listTryOnProviders, DEFAULT_TRYON_PROVIDER_ID } from "@/lib/providers";
import { isTryOnMode, type TryOnMode } from "@/lib/providers/active";
import { SettingsView } from "./SettingsView";

export const metadata = { title: "Settings — ProductMatch" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { tryOnProvider: true },
  });

  const current: TryOnMode = isTryOnMode(user?.tryOnProvider)
    ? user.tryOnProvider
    : DEFAULT_TRYON_PROVIDER_ID;

  const providers = listTryOnProviders().map((p) => ({
    id: p.id,
    label: p.label,
    enabled: p.isEnabled(),
  }));

  return <SettingsView current={current} providers={providers} />;
}

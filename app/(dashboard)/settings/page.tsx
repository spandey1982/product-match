import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsView } from "./SettingsView";

export const metadata = { title: "Settings — Mentis" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      storeName: true, storePhone: true, storeAddress: true, storeCity: true,
      phone: true, phoneVerifiedAt: true,
    },
  });

  return (
    <SettingsView
      initialStoreName={user?.storeName ?? ""}
      initialStorePhone={user?.storePhone ?? ""}
      initialStoreAddress={user?.storeAddress ?? ""}
      initialStoreCity={user?.storeCity ?? ""}
      initialEmail={session.email}
      initialPhone={user?.phone ?? null}
      initialPhoneVerified={!!user?.phoneVerifiedAt}
    />
  );
}

import { notFound } from "next/navigation";
import { getSession, isAdmin, HM_CATALOGUE_MANAGER_ROLE } from "@/lib/auth";
import { db } from "@/lib/db";
import { StaffView } from "./StaffView";

export const metadata = { title: "Catalogue Staff Access — Internal" };

/**
 * Grant/revoke the below-admin HM_CATALOGUE_MANAGER role. ADMIN-only —
 * deliberately not canManageHmCatalogue, so a catalogue manager can never
 * reach this page to escalate their own or anyone else's access.
 */
export default async function HomeMaterialStaffPage() {
  const session = await getSession();
  if (!isAdmin(session)) notFound();

  const catalogueManagers = await db.user.findMany({
    where: { role: HM_CATALOGUE_MANAGER_ROLE, deletedAt: null },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { email: "asc" },
  });

  return <StaffView initialManagers={catalogueManagers} />;
}

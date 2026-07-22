import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { AddressesView } from "./AddressesView";

export const metadata = {
  title: "My Address — Rent — Mentis",
};

export default async function AddressesPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/rent/login?returnTo=/rent/addresses");

  const addresses = await db.customerAddress.findMany({
    where: { customerId: session.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AddressesView
      initialAddresses={addresses.map((a) => ({
        id: a.id,
        label: a.label ?? undefined,
        line1: a.line1,
        pincode: a.pincode,
        landmark: a.landmark ?? undefined,
        isDefault: a.isDefault,
      }))}
    />
  );
}

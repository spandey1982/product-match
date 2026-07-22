import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { AccountView } from "./AccountView";

export const metadata = {
  title: "My Account — Rent — Mentis",
};

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/rent/login?returnTo=/rent/account");

  const customer = await db.customer.findUnique({
    where: { id: session.id },
    select: { name: true, phone: true, email: true },
  });
  if (!customer) redirect("/rent/login?returnTo=/rent/account");

  return (
    <AccountView
      initialName={customer.name ?? ""}
      phone={customer.phone}
      initialEmail={customer.email ?? ""}
    />
  );
}

import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import { RentalMyTryOnsView } from "./RentalMyTryOnsView";

export const metadata = { title: "My Try-Ons — Rent — Mentis" };

export default async function RentMyTryOnsPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/rent/login?returnTo=/rent/my-try-ons");
  }

  return <RentalMyTryOnsView />;
}

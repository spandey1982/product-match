import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import { ShopMyTryOnsView } from "./ShopMyTryOnsView";

export const metadata = { title: "My Try-Ons — Shop — Mentis" };

export default async function ShopMyTryOnsPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/rent/login?returnTo=/shop/my-try-ons");
  }

  return <ShopMyTryOnsView />;
}

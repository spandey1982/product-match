import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import { CustomerLoginView } from "./CustomerLoginView";

interface Props {
  searchParams: Promise<{ returnTo?: string }>;
}

// Shared login page — /shop is buy-only, so its tab title must not say
// "Rent" either. Same isShopContext rule as CustomerLoginView's heading.
export async function generateMetadata({ searchParams }: Props) {
  const { returnTo } = await searchParams;
  const isShopContext = (returnTo ?? "").startsWith("/shop");
  return { title: isShopContext ? "Sign in — Shop — Mentis" : "Sign in — Rent — Mentis" };
}

export default async function CustomerLoginPage({ searchParams }: Props) {
  const session = await getCustomerSession();
  if (session) {
    const { returnTo } = await searchParams;
    redirect(returnTo || "/rent");
  }

  return (
    <Suspense fallback={null}>
      <CustomerLoginView />
    </Suspense>
  );
}

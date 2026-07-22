import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import { CustomerLoginView } from "./CustomerLoginView";

export const metadata = {
  title: "Sign in — Rent — Mentis",
};

interface Props {
  searchParams: Promise<{ returnTo?: string }>;
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

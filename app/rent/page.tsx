import { Suspense } from "react";
import { getCustomerSession } from "@/lib/customer-auth";
import { RentalView } from "./RentalView";

export const metadata = {
  title: "Rent — Mentis",
};

export default async function RentPage() {
  const session = await getCustomerSession();

  return (
    <Suspense fallback={<RentSkeleton />}>
      <RentalView loggedIn={!!session} />
    </Suspense>
  );
}

function RentSkeleton() {
  return (
    <div>
      <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-gray-100 animate-pulse aspect-[3/5]" />
        ))}
      </div>
    </div>
  );
}

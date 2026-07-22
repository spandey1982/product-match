"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RentalOrderCard } from "@/components/rental/RentalOrderCard";
import { RentalOrder } from "@/lib/rental/order-types";

interface OrdersViewProps {
  orders: RentalOrder[];
}

/**
 * Rental requests placed by the signed-in customer. Only ever rendered for a
 * logged-in customer (page.tsx gates on session and fetches from Postgres
 * server-side); Cancel triggers a router.refresh() to pull the updated list
 * back from the server.
 */
export function OrdersView({ orders }: OrdersViewProps) {
  const router = useRouter();

  if (orders.length === 0) {
    return (
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900 mb-6">
          My Rental Requests
        </h1>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <PackageSearch className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No rental requests yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            Requests you place from a product page will show up here.
          </p>
          <Link href="/rent">
            <Button>Browse Rentals</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900 mb-6">
        My Rental Requests
      </h1>
      <div className="max-w-2xl space-y-4">
        {orders.map((order) => (
          <RentalOrderCard key={order.id} order={order} onCancelled={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}

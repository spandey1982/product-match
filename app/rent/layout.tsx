import { PublicHeader } from "@/components/layout/PublicHeader";
import { TrialRoomProvider } from "@/components/trial-room/TrialRoomProvider";
import { getCustomerSession } from "@/lib/customer-auth";

/**
 * Public layout for the /rent marketplace — no auth check. Distinct from
 * app/(dashboard)/layout.tsx, which redirects anonymous visitors to /login.
 *
 * Mounts its own TrialRoomProvider (separate from the retailer dashboard's)
 * keyed to the logged-in customer's id, so photos/try-ons/wishlist never mix
 * between customer accounts sharing a browser. A guest gets a fixed "guest"
 * key — harmless, since try-on generation itself requires login (the public
 * tryon route 401s for guests) and nothing real is ever written under it.
 */
export default async function RentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCustomerSession();
  const storageKey = session ? `trial-room-rental-${session.id}` : "trial-room-rental-guest";

  return (
    <TrialRoomProvider
      storageKey={storageKey}
      tryOnEndpointBase="/api/public/rental-products"
    >
      <div className="min-h-screen bg-[#fafafa]">
        <PublicHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </div>
    </TrialRoomProvider>
  );
}

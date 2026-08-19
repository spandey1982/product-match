import { ShopHeader } from "@/components/layout/ShopHeader";
import { TrialRoomProvider } from "@/components/trial-room/TrialRoomProvider";
import { getCustomerSession } from "@/lib/customer-auth";

/**
 * Public layout for /shop — no auth check, sibling to app/rent/layout.tsx.
 * Mounts its own TrialRoomProvider instance (separate storage key from both
 * the dashboard's and /rent's) keyed to the logged-in customer's id, so
 * photos/try-ons never mix between /shop and /rent even for the same
 * customer using both. A guest gets a fixed "guest" key — harmless, since
 * try-on generation requires login (app/api/public/products/[id]/tryon
 * 401s for guests) and nothing real is ever written under it.
 */
export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCustomerSession();
  const storageKey = session ? `trial-room-shop-${session.id}` : "trial-room-shop-guest";

  return (
    <TrialRoomProvider
      storageKey={storageKey}
      tryOnEndpointBase="/api/public/products"
    >
      <div className="min-h-screen bg-[#fafafa]">
        <ShopHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </div>
    </TrialRoomProvider>
  );
}

"use client";
import { useState } from "react";
import { TrialRoomView } from "@/app/(dashboard)/trial-room/TrialRoomView";
import { TrialRoomSetupModal } from "@/components/trial-room/TrialRoomSetupModal";

/**
 * /shop's "My Try-Ons" — same view as the retailer dashboard's and /rent's,
 * pointed at /shop destinations. wishlistHref stays hidden here too: the
 * banner it gates is driven by TrialRoomProvider's own try-on-linked local
 * wishlist state, not the new server-persisted Wishlist model /shop actually
 * uses (components/shop/WishlistButton.tsx) — pointing it at /shop/wishlist
 * would link to a page that banner's own condition can never populate.
 */
export function ShopMyTryOnsView() {
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  return (
    <>
      <TrialRoomView
        browseHref="/shop"
        onSetupTrialRoom={() => setSetupModalOpen(true)}
        wishlistHref={undefined}
      />
      {setupModalOpen && (
        <TrialRoomSetupModal onClose={() => setSetupModalOpen(false)} />
      )}
    </>
  );
}

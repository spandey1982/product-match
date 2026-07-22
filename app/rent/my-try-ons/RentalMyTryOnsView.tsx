"use client";
import { useState } from "react";
import { TrialRoomView } from "@/app/(dashboard)/trial-room/TrialRoomView";
import { TrialRoomSetupModal } from "@/components/trial-room/TrialRoomSetupModal";

/**
 * Rental marketplace's "My Try-Ons" — the same view as the retailer
 * dashboard's, pointed at rental-appropriate destinations. No dedicated
 * "/trial-room" setup page exists here, so the empty-state CTA opens the
 * same setup modal the per-card and PDP buttons use instead of navigating.
 * No rental wishlist page exists yet, so that banner/link is hidden.
 */
export function RentalMyTryOnsView() {
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  return (
    <>
      <TrialRoomView
        browseHref="/rent"
        onSetupTrialRoom={() => setSetupModalOpen(true)}
        wishlistHref={undefined}
      />
      {setupModalOpen && (
        <TrialRoomSetupModal onClose={() => setSetupModalOpen(false)} />
      )}
    </>
  );
}

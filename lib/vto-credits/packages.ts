/**
 * Customer-facing virtual try-on credit packages for /shop.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ⚠  PLACEHOLDER PRICING — not finalized. Bump PACKAGES_VERSION whenever    │
 * │    a price changes so historical CreditTopUp rows stay attributable to    │
 * │    the price that was actually charged (amountPaise is stored per row,    │
 * │    this config is only the current menu).                                 │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Phase 1: purchasing a package credits the customer immediately with no live
 * payment gateway behind it (same mocked posture RentalOrder ships with
 * today — "Pay at Doorstep", no real charge). Phase 2 wires Razorpay in
 * without changing this config's shape.
 */

export const PACKAGES_VERSION = "2026-08-19-placeholder";

export interface CreditPackage {
  id: string;
  credits: number;
  priceInPaise: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "credits_1", credits: 1, priceInPaise: 1000 },
  { id: "credits_5", credits: 5, priceInPaise: 4000 },
  { id: "credits_10", credits: 10, priceInPaise: 7000 },
];

export function findCreditPackage(id: string): CreditPackage | null {
  return CREDIT_PACKAGES.find((p) => p.id === id) ?? null;
}

// Exact-match strings shared between app/api/public/products/[id]/tryon/route.ts
// (which sends them as `error`) and ShopTryOnButton (which needs to tell these
// two failure reasons apart from a generic one to swap in the right CTA — sign
// in, or open the top-up picker, instead of a dead-end "Retry"). TrialRoomProvider
// only ever surfaces `data.error` as plain display text, with no separate error
// code, so an exact string match is the only hook available.
export const SIGN_IN_FOR_CREDITS_MESSAGE = "Create an account to get 5 free virtual try-ons.";
export const INSUFFICIENT_CREDITS_MESSAGE = "You're out of free try-ons — top up to keep trying things on.";

/** Free starting balance for a newly created Customer — kept alongside the packages it's spent from. */
export const FREE_TRYON_CREDITS = 5;

/** ₹500 spent ⇒ +1 bonus try-on credit (e.g. ₹700 → 1, ₹3699 → 7). Applied to a ShopOrder's amountTotal at creation. */
const REWARD_RUPEES_PER_CREDIT = 500;

export function rewardCreditsForOrder(amountRupees: number): number {
  return Math.floor(amountRupees / REWARD_RUPEES_PER_CREDIT);
}

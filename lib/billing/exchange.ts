/**
 * Rs → credits conversion for retailer wallet top-ups.
 *
 * Deliberately flat — 1 credit = Rs 10, no live exchange rate lookup. Replaces
 * the earlier USD-ledger design (lib/billing/wallet.ts previously called a
 * live forex API on every top-up); the credits system doesn't touch USD at
 * all, so there is nothing to convert a rate for. See the 2026-09-16 pricing
 * redesign for the full rationale.
 */

const RUPEES_PER_CREDIT = 10;

/** Rounds to 1 decimal place — the wallet's fixed credit precision. */
export function convertInrToCredits(amountInr: number): number {
  return Math.round((amountInr / RUPEES_PER_CREDIT) * 10) / 10;
}

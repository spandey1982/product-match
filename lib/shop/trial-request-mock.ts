import { TRIAL_LIFECYCLE_STAGES, TrialStatus, ShopTrialRequestDTO } from "./trial-request-types";
import type { OrderStatusBadgeVariant } from "@/lib/rental/order-mock";

export { getPaymentBadge } from "@/lib/rental/order-mock";

/** Earliest selectable trial date — tomorrow, as a yyyy-mm-dd string for <input type="date">. */
export function tomorrowDateInputValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function formatDisplayDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Mocked — no real confirmation queue exists yet. */
export const EXPECTED_CONFIRMATION_MINUTES = 15;

const SLOT_TIME_RANGE: Record<string, string> = {
  morning: "9 AM – 12 PM",
  afternoon: "12 PM – 4 PM",
  evening: "4 PM – 8 PM",
};

/** "Estimated Trial Window" — the chosen trial date plus slot, as a time range. */
export function trialWindowLabel(trialDate: string, slot: string): string {
  const range = SLOT_TIME_RANGE[slot];
  return range ? `${formatDisplayDate(trialDate)}, ${range}` : formatDisplayDate(trialDate);
}

// Purely cosmetic pacing, same posture as the rental flow's own simulation —
// no backend actually advances these. "sold"/"cancelled" are excluded (see
// TRIAL_LIFECYCLE_STAGES) and can only be reached by a real status change.
const MINUTES_PER_STAGE = 20;

/**
 * The status to *display*: the stored value once it's anything other than
 * the initial "requested" (customer cancelled, retailer advanced it, or a
 * future payment-confirmation action marked it "sold"). Otherwise, a
 * deterministic function of elapsed time walking through
 * TRIAL_LIFECYCLE_STAGES, so the confirmation page has something to show
 * before any real action has happened.
 */
export function getDisplayTrialStatus(request: ShopTrialRequestDTO): TrialStatus {
  if (request.status !== "requested") return request.status;

  const elapsedMinutes = (Date.now() - new Date(request.createdAt).getTime()) / 60000;
  const stageIndex = Math.max(0, Math.floor(elapsedMinutes / MINUTES_PER_STAGE));
  return TRIAL_LIFECYCLE_STAGES[Math.min(TRIAL_LIFECYCLE_STAGES.length - 1, stageIndex)];
}

export const TRIAL_STATUS_LABEL: Record<TrialStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_trial: "Out for Trial",
  tried_out: "Tried Out",
  sold: "Sold",
  cancelled: "Cancelled",
};

export const TRIAL_STATUS_BADGE_VARIANT: Record<TrialStatus, OrderStatusBadgeVariant> = {
  requested: "warning",
  confirmed: "info",
  preparing: "purple",
  out_for_trial: "info",
  tried_out: "success",
  sold: "success",
  cancelled: "error",
};

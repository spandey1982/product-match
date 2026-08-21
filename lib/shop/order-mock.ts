import { TRIAL_LIFECYCLE_STAGES, ShopOrderStatus, ShopOrder } from "./order-types";
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
// no backend actually advances these. order_completed/order_denied/cancelled
// are excluded (see TRIAL_LIFECYCLE_STAGES) and can only be reached by a real
// status change (the delivery-person verification at app/deliver/[id], or a
// cancellation).
const MINUTES_PER_STAGE = 20;

/**
 * The status to *display* for a trial order: the stored value once it's
 * anything other than the initial "requested" (customer cancelled, retailer
 * advanced it, or the delivery person recorded a real outcome). Otherwise, a
 * deterministic function of elapsed time walking through
 * TRIAL_LIFECYCLE_STAGES, so the confirmation page has something to show
 * before any real action has happened.
 */
export function getDisplayOrderStatus(order: ShopOrder): ShopOrderStatus {
  if (order.status !== "requested") return order.status;

  const elapsedMinutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
  const stageIndex = Math.max(0, Math.floor(elapsedMinutes / MINUTES_PER_STAGE));
  return TRIAL_LIFECYCLE_STAGES[Math.min(TRIAL_LIFECYCLE_STAGES.length - 1, stageIndex)];
}

export const ORDER_STATUS_LABEL: Record<ShopOrderStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  out_for_trial: "Out for Trial",
  tried_out: "Tried Out",
  order_completed: "Order Completed",
  order_denied: "Order Denied",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_BADGE_VARIANT: Record<ShopOrderStatus, OrderStatusBadgeVariant> = {
  requested: "warning",
  confirmed: "info",
  preparing: "purple",
  shipped: "info",
  delivered: "success",
  out_for_trial: "info",
  tried_out: "success",
  order_completed: "success",
  order_denied: "error",
  cancelled: "error",
};

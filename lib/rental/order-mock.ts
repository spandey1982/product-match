import { LIFECYCLE_STAGES, OrderStatus, RentalOrder } from "./order-types";

/** Earliest selectable event date — tomorrow, as a yyyy-mm-dd string for <input type="date">. */
export function tomorrowDateInputValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Mocked delivery date: two days ahead of the event so there's time to
 * try it on, clamped to at least tomorrow if the event is very soon.
 */
export function computeDeliveryDate(eventDateIso: string): string {
  const event = new Date(eventDateIso);
  const delivery = new Date(event);
  delivery.setDate(delivery.getDate() - 2);

  const earliest = new Date();
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() + 1);

  const chosen = delivery < earliest ? earliest : delivery;
  return chosen.toISOString().slice(0, 10);
}

/** Mocked 24-hour home-trial window starting the day after delivery. */
export function computeExpectedTrialWindow(deliveryDateIso: string): string {
  const start = new Date(deliveryDateIso);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)} (24 hrs from delivery)`;
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

/** "Estimated Delivery Window" — the delivery date plus the customer's chosen slot, as a time range. */
export function deliveryWindowLabel(deliveryDateIso: string, slot: string): string {
  const range = SLOT_TIME_RANGE[slot];
  return range ? `${formatDisplayDate(deliveryDateIso)}, ${range}` : formatDisplayDate(deliveryDateIso);
}

// Purely cosmetic pacing so the order list has something to show besides
// "Requested" forever — no backend actually advances these. Each stage lasts
// this many simulated minutes before moving to the next; "completed" plateaus.
const MINUTES_PER_STAGE = 20;

/**
 * The status to *display* for an order: real once cancelled (the only
 * user-driven transition), otherwise a deterministic function of how long
 * ago it was requested, walking through LIFECYCLE_STAGES. `order.status`
 * itself is never overwritten by this — it stays "requested" in storage
 * unless the customer cancels.
 */
export function getDisplayStatus(order: RentalOrder): OrderStatus {
  if (order.status === "cancelled") return "cancelled";

  const elapsedMinutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
  const stageIndex = Math.max(0, Math.floor(elapsedMinutes / MINUTES_PER_STAGE));
  return LIFECYCLE_STAGES[Math.min(LIFECYCLE_STAGES.length - 1, stageIndex)];
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  trial: "Trial",
  delivered: "Delivered",
  pickup_scheduled: "Pickup Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type OrderStatusBadgeVariant = "default" | "success" | "warning" | "error" | "info" | "purple" | "outline";

export const ORDER_STATUS_BADGE_VARIANT: Record<OrderStatus, OrderStatusBadgeVariant> = {
  requested: "warning",
  confirmed: "info",
  preparing: "purple",
  out_for_delivery: "info",
  trial: "purple",
  delivered: "success",
  pickup_scheduled: "warning",
  completed: "success",
  cancelled: "error",
};

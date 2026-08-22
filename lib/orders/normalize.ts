import { RentalOrder } from "@/lib/rental/order-types";
import { ShopOrder } from "@/lib/shop/order-types";
import {
  ORDER_STATUS_LABEL as RENTAL_STATUS_LABEL,
  ORDER_STATUS_BADGE_VARIANT as RENTAL_STATUS_VARIANT,
  getDisplayStatus,
  getPaymentBadge,
  formatDisplayDate,
  deliveryWindowLabel,
} from "@/lib/rental/order-mock";
import {
  ORDER_STATUS_LABEL as TRIAL_STATUS_LABEL,
  ORDER_STATUS_BADGE_VARIANT as TRIAL_STATUS_VARIANT,
  getDisplayOrderStatus,
  trialWindowLabel,
} from "@/lib/shop/order-mock";
import { NormalizedOrder } from "./types";

const SLOT_LABEL: Record<string, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };

export function normalizeRentalOrder(order: RentalOrder): NormalizedOrder {
  const displayStatus = getDisplayStatus(order);
  const paymentBadge = getPaymentBadge(order);

  return {
    kind: "rental",
    id: order.id,
    createdAt: order.createdAt,
    productTitle: order.productTitle,
    productImage: order.productImage,
    status: order.status,
    displayStatus,
    statusLabel: RENTAL_STATUS_LABEL[displayStatus],
    statusVariant: RENTAL_STATUS_VARIANT[displayStatus],
    paymentMethod: order.paymentMethod,
    paymentLabel: paymentBadge.label,
    paymentVariant: paymentBadge.variant,
    windowLabel: "Estimated Delivery Window",
    windowValue: deliveryWindowLabel(order.deliveryDate, order.deliverySlot),
    price: order.rentalPricePerDay,
    priceSuffix: "/day",
    deposit: order.deposit,
    customer: order.customer,
    address: order.address,
    eventDate: order.eventDate,
    eventDateLabel: formatDisplayDate(order.eventDate),
    slot: order.deliverySlot,
    slotLabel: SLOT_LABEL[order.deliverySlot] ?? order.deliverySlot,
    specialInstructions: order.specialInstructions,
  };
}

/** Trial ShopOrders only — callers must check `order.orderType === "trial"` before normalizing (see lib/orders/types.ts for why "buy" is excluded). */
export function normalizeTrialOrder(order: ShopOrder): NormalizedOrder {
  const displayStatus = getDisplayOrderStatus(order);
  const paymentBadge = getPaymentBadge(order);
  const trialDate = order.trialDate ?? "";
  const trialSlot = order.trialSlot ?? "";

  return {
    kind: "trial",
    id: order.id,
    createdAt: order.createdAt,
    productTitle: order.productTitle,
    productImage: order.productImage,
    status: order.status,
    displayStatus,
    statusLabel: TRIAL_STATUS_LABEL[displayStatus],
    statusVariant: TRIAL_STATUS_VARIANT[displayStatus],
    paymentMethod: order.paymentMethod,
    paymentLabel: paymentBadge.label,
    paymentVariant: paymentBadge.variant,
    windowLabel: "Estimated Trial Window",
    windowValue: trialWindowLabel(trialDate, trialSlot),
    price: order.amountTotal,
    priceSuffix: "",
    deposit: null,
    customer: order.customer,
    address: order.address,
    eventDate: trialDate,
    eventDateLabel: trialDate ? formatDisplayDate(trialDate) : "—",
    slot: trialSlot,
    slotLabel: SLOT_LABEL[trialSlot] ?? trialSlot,
    specialInstructions: order.specialInstructions,
  };
}

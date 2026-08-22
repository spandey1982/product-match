"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  HeartHandshake,
  Clock,
  Truck,
  IndianRupee,
  Ruler,
  Wallet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Fact, SummaryRow } from "@/components/orders/OrderDetailPrimitives";
import { ShopOrder, ShopOrderStatus } from "@/lib/shop/order-types";
import {
  EXPECTED_CONFIRMATION_MINUTES,
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABEL,
  trialWindowLabel,
  formatDisplayDate,
  getDisplayOrderStatus,
  getPaymentBadge,
} from "@/lib/shop/order-mock";

const SLOT_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

interface ShopTrialConfirmationViewProps {
  order: ShopOrder | null;
}

/**
 * Home-trial request receipt — sibling to ShopOrderConfirmationView, for a
 * ShopOrder with orderType "trial" (/shop's "Try & Buy" flow). No invoice;
 * purely a "we've got your request" confirmation, reachable without login
 * since a guest may have just placed it. Pay Now is intentionally disabled
 * here (see memory "shop-trial-payment-confirmation-deferred") — the real
 * payment pipeline is buy-order-specific and building a trial equivalent is
 * deferred work, not a small addition.
 */
export function ShopTrialConfirmationView({ order }: ShopTrialConfirmationViewProps) {
  const [showTracking, setShowTracking] = useState(false);

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Request not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          This trial request doesn&apos;t exist, or the link is incorrect.
        </p>
        <Link href="/shop">
          <Button variant="secondary">Continue Browsing</Button>
        </Link>
      </div>
    );
  }

  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const firstName = order.customer.name.trim().split(/\s+/)[0] || "there";
  const displayStatus = getDisplayOrderStatus(order);
  const paymentBadge = getPaymentBadge(order);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Shop
      </Link>

      {/* Warm hero */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50/60 to-white border border-amber-100 p-8 text-center mb-4">
        <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <HeartHandshake className="h-8 w-8 text-amber-600" strokeWidth={1.75} />
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900 mb-1.5">
          Home Trial Request Received
        </h1>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Thank you, {firstName} — we&apos;ve got your request for {order.productTitle} and our team is
          reviewing it now.
        </p>
      </div>

      {/* Product + order number + status */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4 border-amber-100">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-16 w-14 sm:h-20 sm:w-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
            {order.productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.productImage} alt={order.productTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xl">🧵</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{order.productTitle}</p>
            <p className="text-[11px] text-gray-400 tracking-wide mt-1.5">Order Number</p>
            <p className="text-sm font-semibold text-gray-900 font-mono truncate">#{orderNumber}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant={ORDER_STATUS_BADGE_VARIANT[displayStatus]} className="text-sm px-3 py-1">
              {ORDER_STATUS_LABEL[displayStatus]}
            </Badge>
            <Badge variant={paymentBadge.variant} className="text-xs px-2.5 py-0.5">
              {paymentBadge.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Key facts */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5 grid grid-cols-2 gap-x-4 gap-y-5">
          <Fact icon={Clock} label="Expected Confirmation" value={`~${EXPECTED_CONFIRMATION_MINUTES} minutes`} />
          <Fact
            icon={Truck}
            label="Estimated Trial Window"
            value={trialWindowLabel(order.trialDate ?? "", order.trialSlot ?? "")}
          />
          <Fact icon={IndianRupee} label="Price" value={formatCurrency(order.amountTotal)} />
          <Fact icon={Wallet} label="Payment Method" value={order.paymentMethod} />
          {order.size && <Fact icon={Ruler} label="Size" value={order.size} />}
        </CardContent>
      </Card>

      {/* Online payment — disabled for now, see memory shop-trial-payment-confirmation-deferred */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="text-sm font-semibold text-gray-900">Prefer to pay online?</p>
            <span className="text-sm font-bold text-gray-900">{formatCurrency(order.amountTotal)}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Pay now, or continue with Pay at Doorstep — whichever you prefer.
          </p>
          <Button disabled className="w-full">
            Coming soon
          </Button>
        </CardContent>
      </Card>

      {/* Track Order — status timeline */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <button
          type="button"
          onClick={() => setShowTracking((v) => !v)}
          className="w-full flex items-center justify-between p-5"
        >
          <span className="text-sm font-semibold text-gray-900">Order status</span>
          {showTracking ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        {showTracking && (
          <div className="px-5 pb-5 space-y-1">
            <TimelineStep label="Request received" state={stepState(displayStatus, "requested")} />
            <TimelineStep label="Awaiting retailer confirmation" state={stepState(displayStatus, "confirmed")} />
            <TimelineStep label="Out for Trial" state={stepState(displayStatus, "out_for_trial")} />
            <TimelineStep label="Tried Out" state={stepState(displayStatus, "tried_out")} />
            {order.status === "order_completed" && <TimelineStep label="Order Completed" state="done" />}
            {order.status === "order_denied" && <TimelineStep label="Order Denied" state="denied" />}
          </div>
        )}
      </Card>

      {/* CTAs */}
      <div className="flex gap-3 mb-6">
        <Button variant="outline" className="flex-1" onClick={() => setShowTracking(true)}>
          Track Order
        </Button>
        <Link href="/shop" className="flex-1">
          <Button className="w-full">Continue Browsing</Button>
        </Link>
      </div>

      {/* Submitted details recap */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardHeader className="px-5 pt-4 pb-1">
          <CardTitle className="font-heading text-base font-medium">Your request details</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-2 divide-y divide-gray-50">
          <SummaryRow label="Name" value={order.customer.name} />
          <SummaryRow label="Phone" value={order.customer.phone} />
          {order.customer.email && <SummaryRow label="Email" value={order.customer.email} />}
          <SummaryRow label="Address" value={order.address.line1} />
          <SummaryRow label="Pincode" value={order.address.pincode} />
          {order.address.landmark && <SummaryRow label="Landmark" value={order.address.landmark} />}
          {order.trialDate && <SummaryRow label="Trial Date" value={formatDisplayDate(order.trialDate)} />}
          {order.trialSlot && (
            <SummaryRow label="Preferred Trial Slot" value={SLOT_LABEL[order.trialSlot] ?? order.trialSlot} />
          )}
          {order.specialInstructions && (
            <SummaryRow label="Special Instructions" value={order.specialInstructions} />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center pb-8">
        This is a mocked trial request for demo purposes — no invoice has been generated.
      </p>
    </div>
  );
}

const TIMELINE_ORDER: ShopOrderStatus[] = ["requested", "confirmed", "preparing", "out_for_trial", "tried_out"];

/**
 * done/active/pending for a timeline step, based on the current display
 * status's position in the lifecycle. order_completed/order_denied/cancelled
 * aren't in TIMELINE_ORDER (all real-only terminal branches, never part of
 * the 4-step cosmetic lifecycle) — reaching any of them implies every
 * regular step already completed, so they fall past the end rather than
 * indexOf's -1 (which would otherwise mark every step "pending").
 */
function stepState(displayStatus: ShopOrderStatus, step: ShopOrderStatus): "done" | "active" | "pending" {
  const rawIndex = TIMELINE_ORDER.indexOf(displayStatus);
  const currentIndex = rawIndex === -1 ? TIMELINE_ORDER.length : rawIndex;
  const stepIndex = TIMELINE_ORDER.indexOf(step);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

function TimelineStep({ label, state }: { label: string; state: "done" | "active" | "pending" | "denied" }) {
  const dotClass =
    state === "done"
      ? "bg-emerald-500"
      : state === "denied"
        ? "bg-red-500"
        : state === "active"
          ? "bg-amber-500 animate-pulse"
          : "bg-gray-200";
  const textClass = state === "pending" ? "text-gray-400" : "text-gray-900";
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotClass}`} />
      <span className={`text-sm font-medium ${textClass}`}>{label}</span>
    </div>
  );
}

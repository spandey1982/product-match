"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Truck, CalendarClock, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { Fact, SummaryRow } from "@/components/rental/OrderDetailPrimitives";
import { RentalOrder, LIFECYCLE_STAGES, OrderStatus } from "@/lib/rental/order-types";
import {
  EXPECTED_CONFIRMATION_MINUTES,
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABEL,
  deliveryWindowLabel,
  formatDisplayDate,
  getDisplayStatus,
} from "@/lib/rental/order-mock";

const SLOT_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

interface RentalOrderAdminViewProps {
  order: RentalOrder;
}

/**
 * Retailer-facing counterpart to the customer's RentalOrderConfirmationView —
 * same product/facts/details cards, but no "thank you" greeting or Continue
 * Browsing (this isn't a receipt, it's a working view), plus the one thing a
 * retailer actually needs here: a way to advance or cancel the order.
 */
export function RentalOrderAdminView({ order }: RentalOrderAdminViewProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");

  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const displayStatus = getDisplayStatus(order);
  const isCancelled = displayStatus === "cancelled";

  async function updateStatus(status: OrderStatus) {
    setError("");
    setUpdating(status);
    try {
      const res = await fetch(`/api/rental-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update status");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/rental-orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Rental Orders
      </Link>

      {/* Product + order number + status */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
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
          <Badge variant={ORDER_STATUS_BADGE_VARIANT[displayStatus]} className="text-sm px-3 py-1 shrink-0">
            {ORDER_STATUS_LABEL[displayStatus]}
          </Badge>
        </CardContent>
      </Card>

      {/* Key facts */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5 grid grid-cols-2 gap-x-4 gap-y-5">
          <Fact icon={Clock} label="Expected Confirmation" value={`~${EXPECTED_CONFIRMATION_MINUTES} minutes`} />
          <Fact
            icon={Truck}
            label="Estimated Delivery Window"
            value={deliveryWindowLabel(order.deliveryDate, order.deliverySlot)}
          />
          <Fact icon={CalendarClock} label="Rental Price" value={`${formatCurrency(order.rentalPricePerDay)} / day`} />
          <Fact icon={ShieldCheck} label="Deposit" value={formatCurrency(order.deposit)} />
          <Fact icon={Wallet} label="Payment" value="Pay at Doorstep" className="col-span-2" />
        </CardContent>
      </Card>

      {/* Status management */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardHeader className="px-5 pt-4 pb-1">
          <CardTitle className="font-heading text-base font-medium">Update Status</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-2">
          <div className="flex flex-wrap gap-2">
            {LIFECYCLE_STAGES.map((stage) => {
              const active = displayStatus === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => updateStatus(stage)}
                  disabled={isCancelled || updating !== null || active}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    active
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50",
                    (isCancelled || updating !== null) && !active && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {updating === stage ? "Updating…" : ORDER_STATUS_LABEL[stage]}
                </button>
              );
            })}
          </div>

          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

          <div className="h-px bg-gray-100 my-4" />

          {isCancelled ? (
            <p className="text-sm text-red-600 font-medium">This order has been cancelled.</p>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => updateStatus("cancelled")}
              disabled={updating !== null}
            >
              {updating === "cancelled" ? "Cancelling…" : "Cancel Order"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Submitted details recap */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardHeader className="px-5 pt-4 pb-1">
          <CardTitle className="font-heading text-base font-medium">Request Details</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-2 divide-y divide-gray-50">
          <SummaryRow label="Age" value={order.ageGroup} />
          <SummaryRow label="Name" value={order.customer.name} />
          <SummaryRow label="Phone" value={order.customer.phone} />
          {order.customer.email && <SummaryRow label="Email" value={order.customer.email} />}
          <SummaryRow label="Address" value={order.address.line1} />
          <SummaryRow label="Pincode" value={order.address.pincode} />
          {order.address.landmark && <SummaryRow label="Landmark" value={order.address.landmark} />}
          <SummaryRow label="Event Date" value={formatDisplayDate(order.eventDate)} />
          <SummaryRow label="Preferred Slot" value={SLOT_LABEL[order.deliverySlot] ?? order.deliverySlot} />
          {order.specialInstructions && (
            <SummaryRow label="Special Instructions" value={order.specialInstructions} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

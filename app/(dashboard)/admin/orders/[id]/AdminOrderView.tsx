"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Truck, IndianRupee, Wallet, CreditCard, Hash, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { Fact, SummaryRow } from "@/components/orders/OrderDetailPrimitives";
import { NormalizedOrder } from "@/lib/orders/types";
import { PaymentSummary } from "@/lib/rental/payment";
import {
  EXPECTED_CONFIRMATION_MINUTES,
  formatDisplayDate,
  ORDER_STATUS_LABEL as RENTAL_STATUS_LABEL,
} from "@/lib/rental/order-mock";
import { LIFECYCLE_STAGES } from "@/lib/rental/order-types";
import { ORDER_STATUS_LABEL as TRIAL_STATUS_LABEL } from "@/lib/shop/order-mock";
import { TRIAL_ADMIN_STAGES } from "@/lib/shop/order-types";

interface AdminOrderViewProps {
  order: NormalizedOrder;
  payment: PaymentSummary | null;
}

const STAGE_LABEL: Record<NormalizedOrder["kind"], Record<string, string>> = {
  rental: RENTAL_STATUS_LABEL,
  trial: TRIAL_STATUS_LABEL,
};

/**
 * Admin-facing order detail — one view for both a RentalOrder and a trial
 * ShopOrder, driven entirely by the NormalizedOrder shape (lib/orders/types.ts)
 * so this component never branches on which DB table the order came from,
 * only on `order.kind` for the handful of things that genuinely differ
 * (which status stages are selectable, the Payment record card).
 */
export function AdminOrderView({ order, payment }: AdminOrderViewProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");

  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const isCancelled = order.displayStatus === "cancelled";
  const stages = order.kind === "rental" ? LIFECYCLE_STAGES : TRIAL_ADMIN_STAGES;
  const stageLabel = STAGE_LABEL[order.kind];

  async function updateStatus(status: string) {
    setError("");
    setUpdating(status);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
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
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Link>

      {/* Card 1: product + order number + status */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-16 w-14 sm:h-20 sm:w-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
            {order.productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.productImage} alt={order.productTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xl">
                {order.kind === "rental" ? "🧵" : "🛍️"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{order.productTitle}</p>
            <p className="text-[11px] text-gray-400 tracking-wide mt-1.5">Order Number</p>
            <p className="text-sm font-semibold text-gray-900 font-mono truncate">#{orderNumber}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant={order.statusVariant} className="text-sm px-3 py-1">
              {order.statusLabel}
            </Badge>
            <Badge variant={order.paymentVariant} className="text-xs px-2.5 py-0.5">
              {order.paymentLabel}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: event details (4 facts) */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5 grid grid-cols-2 gap-x-4 gap-y-5">
          <Fact icon={Clock} label="Expected Confirmation" value={`~${EXPECTED_CONFIRMATION_MINUTES} minutes`} />
          <Fact icon={Truck} label={order.windowLabel} value={order.windowValue} />
          <Fact icon={IndianRupee} label="Price" value={`${formatCurrency(order.price)}${order.priceSuffix}`} />
          <Fact icon={Wallet} label="Payment Method" value={order.paymentMethod} />
        </CardContent>
      </Card>

      {/* Payment record — only when an online payment was attempted (rental orders only; Pay at Doorstep bookings have no Payment row at all) */}
      {payment && (
        <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
          <CardHeader className="px-5 pt-4 pb-1">
            <CardTitle className="font-heading text-base font-medium">Payment</CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-2 gap-x-4 gap-y-5">
            <Fact icon={CreditCard} label="Payment Status" value={order.paymentLabel} />
            <Fact icon={Wallet} label="Amount" value={formatCurrency(payment.amountInr)} />
            <Fact icon={Hash} label="Payment ID" value={payment.razorpayPaymentId ?? "—"} />
            <Fact icon={Hash} label="Order ID" value={payment.razorpayOrderId} />
            <Fact
              icon={CalendarDays}
              label="Payment Date"
              value={formatDisplayDate(payment.createdAt)}
              className="col-span-2"
            />
          </CardContent>
        </Card>
      )}

      {/* Card 3: status chips */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardHeader className="px-5 pt-4 pb-1">
          <CardTitle className="font-heading text-base font-medium">Update Status</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-2">
          <div className="flex flex-wrap gap-2">
            {stages.map((stage) => {
              const active = order.displayStatus === stage;
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
                  {updating === stage ? "Updating…" : stageLabel[stage]}
                </button>
              );
            })}
          </div>

          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </CardContent>
      </Card>

      {/* Card 4: request details */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardHeader className="px-5 pt-4 pb-1">
          <CardTitle className="font-heading text-base font-medium">Request Details</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-2 divide-y divide-gray-50">
          <SummaryRow label="Name" value={order.customer.name} />
          <SummaryRow label="Phone" value={order.customer.phone} />
          {order.customer.email && <SummaryRow label="Email" value={order.customer.email} />}
          <SummaryRow label="Address" value={order.address.line1} />
          <SummaryRow label="Pincode" value={order.address.pincode} />
          {order.address.landmark && <SummaryRow label="Landmark" value={order.address.landmark} />}
          <SummaryRow label="Event Date" value={order.eventDateLabel} />
          <SummaryRow label="Preferred Slot" value={order.slotLabel} />
          {order.specialInstructions && (
            <SummaryRow label="Special Instructions" value={order.specialInstructions} />
          )}
        </CardContent>
      </Card>

      {/* Cancel — deliberately last on the page, separate from status advancement */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5">
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
    </div>
  );
}

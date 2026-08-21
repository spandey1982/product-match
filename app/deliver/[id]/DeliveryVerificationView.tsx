"use client";
import { useState } from "react";
import {
  User,
  Phone,
  MapPin,
  IndianRupee,
  Ruler,
  CalendarClock,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Fact } from "@/components/rental/OrderDetailPrimitives";
import { ShopOrder } from "@/lib/shop/order-types";
import { formatDisplayDate, trialWindowLabel } from "@/lib/shop/order-mock";

const SLOT_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

type Outcome = "completed" | "denied";
type PendingChoice = Outcome | null;

interface DeliveryVerificationViewProps {
  order: ShopOrder | null;
}

/**
 * Single-screen handoff for the delivery partner: everything they need at
 * the doorstep (product, customer, address, trial window) plus one two-step
 * action to record the outcome before they leave. Step 1 picks Order
 * Completed/Order Denied, step 2 asks for an explicit confirm — no accidental
 * single-tap resolution of someone's order. Once resolved, the action area
 * locks into a read-only outcome state; there is no undo from this screen.
 */
export function DeliveryVerificationView({ order: initialOrder }: DeliveryVerificationViewProps) {
  const [order, setOrder] = useState(initialOrder);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!order) {
    return (
      <StatusScreen
        icon={AlertTriangle}
        title="Order not found"
        message="This delivery link doesn't exist, or the id is incorrect."
      />
    );
  }

  if (order.orderType !== "trial") {
    return (
      <StatusScreen
        icon={AlertTriangle}
        title="Not a home-trial order"
        message="This link is only valid for home-trial orders."
      />
    );
  }

  const alreadyResolved = order.status === "order_completed" || order.status === "order_denied";
  const cancelled = order.status === "cancelled";

  async function submitOutcome(outcome: Outcome) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/shop/orders/${order!.id}/deliver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not record the outcome");
      setOrder(data.order as ShopOrder);
      setPendingChoice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the outcome");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-5">
        <p className="text-xs font-semibold text-indigo-500 tracking-wide uppercase mb-1">Home Trial Delivery</p>
        <p className="text-sm text-gray-400 font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
      </div>

      {/* Product */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-16 w-14 rounded-xl overflow-hidden bg-gray-50 shrink-0">
            {order.productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.productImage} alt={order.productTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xl">🧵</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{order.productTitle}</p>
            {order.storeName && <p className="text-xs text-gray-400 truncate">{order.storeName}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Key facts */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5 grid grid-cols-2 gap-x-4 gap-y-5">
          <Fact icon={IndianRupee} label="Price" value={formatCurrency(order.amountTotal)} />
          {order.size && <Fact icon={Ruler} label="Size" value={order.size} />}
          <Fact
            icon={CalendarClock}
            label="Trial Window"
            value={trialWindowLabel(order.trialDate ?? "", order.trialSlot ?? "")}
            className="col-span-2"
          />
        </CardContent>
      </Card>

      {/* Customer + delivery details */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5 space-y-4">
          <Fact icon={User} label="Customer" value={order.customer.name} />
          <Fact icon={Phone} label="Phone" value={order.customer.phone} />
          <Fact
            icon={MapPin}
            label="Address"
            value={[order.address.line1, order.address.landmark, order.address.pincode].filter(Boolean).join(", ")}
          />
          {order.specialInstructions && (
            <Fact icon={MessageSquare} label="Special Instructions" value={order.specialInstructions} />
          )}
        </CardContent>
      </Card>

      {/* Outcome action */}
      {cancelled ? (
        <StatusBanner tone="neutral" icon={AlertTriangle} label="This order was cancelled." />
      ) : alreadyResolved ? (
        <StatusBanner
          tone={order.status === "order_completed" ? "success" : "error"}
          icon={order.status === "order_completed" ? CheckCircle2 : XCircle}
          label={
            order.status === "order_completed"
              ? "Recorded — Order Completed."
              : "Recorded — Order Denied."
          }
        />
      ) : pendingChoice ? (
        <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4 border-2 border-amber-200">
          <CardContent className="p-5 text-center">
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Confirm: mark this order as {pendingChoice === "completed" ? "Completed" : "Denied"}?
            </p>
            <p className="text-xs text-gray-500 mb-4">This can&apos;t be undone from this screen.</p>
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPendingChoice(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant={pendingChoice === "denied" ? "destructive" : "default"}
                className="flex-1"
                loading={submitting}
                onClick={() => submitOutcome(pendingChoice)}
              >
                Yes, Confirm
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 mb-4">
          <Button size="lg" className="w-full" onClick={() => setPendingChoice("completed")}>
            <CheckCircle2 className="h-4 w-4" />
            Order Completed
          </Button>
          <Button variant="destructive" size="lg" className="w-full" onClick={() => setPendingChoice("denied")}>
            <XCircle className="h-4 w-4" />
            Order Denied
          </Button>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-8">
        {order.trialDate ? `Trial date: ${formatDisplayDate(order.trialDate)}` : ""}
        {order.trialSlot ? ` · ${SLOT_LABEL[order.trialSlot] ?? order.trialSlot}` : ""}
      </p>
    </div>
  );
}

function StatusBanner({
  tone,
  icon: Icon,
  label,
}: {
  tone: "success" | "error" | "neutral";
  icon: React.ElementType;
  label: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "error"
        ? "bg-red-50 text-red-700 border-red-100"
        : "bg-gray-50 text-gray-600 border-gray-100";
  return (
    <div className={`rounded-3xl border p-5 flex items-center gap-3 mb-4 ${toneClass}`}>
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function StatusScreen({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ElementType;
  title: string;
  message: string;
}) {
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Icon className="h-6 w-6 text-gray-500" strokeWidth={1.75} />
      </div>
      <h1 className="text-lg font-semibold text-gray-900 mb-1.5">{title}</h1>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

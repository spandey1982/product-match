"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  HeartHandshake,
  Clock,
  Truck,
  CalendarClock,
  ShieldCheck,
  Wallet,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Fact, SummaryRow } from "@/components/orders/OrderDetailPrimitives";
import { RentalOrder } from "@/lib/rental/order-types";
import { loadRazorpayScript, type RazorpayPaymentResponse } from "@/lib/razorpay-client";
import {
  EXPECTED_CONFIRMATION_MINUTES,
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABEL,
  deliveryWindowLabel,
  formatDisplayDate,
  getDisplayStatus,
  getPaymentBadge,
} from "@/lib/rental/order-mock";

const SLOT_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

interface RentalOrderConfirmationViewProps {
  order: RentalOrder | null;
  /** Is the viewer logged in as this order's own customer? Gates the Pay Now button — prepaying needs a real account, browsing/booking doesn't. */
  canPayOnline: boolean;
}

/**
 * Rental request receipt — order now lives in Postgres (RentalOrder),
 * fetched server-side by page.tsx. No invoice; this is purely a "we've got
 * your request" confirmation, reachable without login since a guest may have
 * just placed it. Pay at Doorstep remains the default — Pay Now (below) is
 * an optional online-prepayment path on top of it, not a replacement.
 */
export function RentalOrderConfirmationView({ order, canPayOnline }: RentalOrderConfirmationViewProps) {
  const [showTracking, setShowTracking] = useState(false);

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Request not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          This rental request doesn&apos;t exist, or the link is incorrect.
        </p>
        <Link href="/rent">
          <Button variant="secondary">Continue Browsing</Button>
        </Link>
      </div>
    );
  }

  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const firstName = order.customer.name.trim().split(/\s+/)[0] || "there";
  const displayStatus = getDisplayStatus(order);
  const paymentBadge = getPaymentBadge(order);
  const amountInr = order.rentalPricePerDay * order.rentalDurationDays + order.deposit;
  const canRetryOrPay = order.paymentStatus === "pending" || order.paymentStatus === "failed";

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/rent/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Orders
      </Link>

      {/* Warm hero */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50/60 to-white border border-amber-100 p-8 text-center mb-4">
        <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <HeartHandshake className="h-8 w-8 text-amber-600" strokeWidth={1.75} />
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900 mb-1.5">
          Rental Request Received
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
            label="Estimated Delivery Window"
            value={deliveryWindowLabel(order.deliveryDate, order.deliverySlot)}
          />
          <Fact icon={CalendarClock} label="Rental Price" value={`${formatCurrency(order.rentalPricePerDay)} / day`} />
          <Fact icon={ShieldCheck} label="Deposit" value={formatCurrency(order.deposit)} />
          <Fact icon={Wallet} label="Payment Method" value={order.paymentMethod} className="col-span-2" />
        </CardContent>
      </Card>

      {/* Online prepayment — optional; Pay at Doorstep is always available too */}
      {canRetryOrPay && (
        <PayNowCard
          rentalOrderId={order.id}
          amountInr={amountInr}
          canPayOnline={canPayOnline}
          failed={order.paymentStatus === "failed"}
        />
      )}

      {/* Track Order — mocked status timeline */}
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
            <TimelineStep label="Request received" state="done" />
            <TimelineStep label="Awaiting retailer confirmation" state="active" />
            <TimelineStep label="Out for delivery" state="pending" />
            <TimelineStep label="Delivered" state="pending" />
          </div>
        )}
      </Card>

      {/* CTAs */}
      <div className="flex gap-3 mb-6">
        <Button variant="outline" className="flex-1" onClick={() => setShowTracking(true)}>
          Track Order
        </Button>
        <Link href="/rent" className="flex-1">
          <Button className="w-full">Continue Browsing</Button>
        </Link>
      </div>

      {/* Submitted details recap */}
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardHeader className="px-5 pt-4 pb-1">
          <CardTitle className="font-heading text-base font-medium">Your request details</CardTitle>
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

      <p className="text-xs text-gray-400 text-center pb-8">
        This is a mocked rental request for demo purposes — no invoice has been generated.
      </p>
    </div>
  );
}

interface PayNowCardProps {
  rentalOrderId: string;
  amountInr: number;
  canPayOnline: boolean;
  failed: boolean;
}

/** Optional online-prepayment card — Pay at Doorstep remains available regardless of whether this is used. */
function PayNowCard({ rentalOrderId, amountInr, canPayOnline, failed }: PayNowCardProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const handlePayNow = useCallback(async () => {
    setError(null);
    setProcessing(true);

    try {
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalOrderId }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json();
        throw new Error(data.error ?? "Failed to start payment");
      }

      const order = (await orderRes.json()) as {
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
      };

      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay not loaded");

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Mentis",
        description: "Rental booking payment",
        order_id: order.orderId,
        handler: async (response: RazorpayPaymentResponse) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            if (!verifyRes.ok) {
              const data = await verifyRes.json();
              throw new Error(data.error ?? "Verification failed");
            }

            setPaid(true);
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
        theme: { color: "#4f46e5" },
      });

      rzp.open();
    } catch (err) {
      setError((err as Error).message);
      setProcessing(false);
    }
  }, [rentalOrderId, router]);

  if (paid) {
    return (
      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4 border-emerald-100">
        <CardContent className="p-5 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Payment received</p>
            <p className="text-xs text-gray-500 mt-0.5">Your booking is now fully prepaid.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <p className="text-sm font-semibold text-gray-900">
            {failed ? "Payment didn't go through" : "Prefer to pay online?"}
          </p>
          <span className="text-sm font-bold text-gray-900">{formatCurrency(amountInr)}</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {failed
            ? "You can retry the payment, or simply pay at your doorstep instead."
            : "Pay rental + deposit now, or continue with Pay at Doorstep — whichever you prefer."}
        </p>

        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1 mb-3">
            <AlertTriangle className="h-3 w-3" />
            {error}
          </p>
        )}

        {canPayOnline ? (
          <Button onClick={handlePayNow} disabled={processing} className="w-full">
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : failed ? (
              "Retry Payment"
            ) : (
              "Pay Now"
            )}
          </Button>
        ) : (
          <Link href={`/rent/login?returnTo=/rent/orders/${rentalOrderId}`}>
            <Button variant="outline" className="w-full">
              Sign in to pay online
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineStep({ label, state }: { label: string; state: "done" | "active" | "pending" }) {
  const dotClass =
    state === "done" ? "bg-emerald-500" : state === "active" ? "bg-amber-500 animate-pulse" : "bg-gray-200";
  const textClass = state === "pending" ? "text-gray-400" : "text-gray-900";
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotClass}`} />
      <span className={`text-sm font-medium ${textClass}`}>{label}</span>
    </div>
  );
}

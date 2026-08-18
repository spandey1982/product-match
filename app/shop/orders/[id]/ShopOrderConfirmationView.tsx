"use client";
import Link from "next/link";
import { ArrowLeft, PackageCheck, Truck, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Fact, SummaryRow } from "@/components/rental/OrderDetailPrimitives";
import { ShopOrder, ShopOrderStatus } from "@/lib/shop/order-types";

const SLOT_LABEL: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

const STATUS_LABEL: Record<ShopOrderStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_BADGE_VARIANT: Record<ShopOrderStatus, "warning" | "info" | "purple" | "success" | "error"> = {
  requested: "warning",
  confirmed: "info",
  preparing: "purple",
  shipped: "info",
  delivered: "success",
  cancelled: "error",
};

interface ShopOrderConfirmationViewProps {
  order: ShopOrder | null;
}

/**
 * Purchase receipt — simpler sibling of RentalOrderConfirmationView: no
 * online-prepayment card (no live gateway wired for /shop orders yet — see
 * lib/shop/order-types.ts) and no simulated status-progression timeline,
 * just the order's actual stored status.
 */
export function ShopOrderConfirmationView({ order }: ShopOrderConfirmationViewProps) {
  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Order not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          This order doesn&apos;t exist, or the link is incorrect.
        </p>
        <Link href="/shop">
          <Button variant="secondary">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const firstName = order.customer.name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Continue Shopping
      </Link>

      <div className="rounded-3xl bg-gradient-to-br from-indigo-50 via-purple-50/60 to-white border border-indigo-100 p-8 text-center mb-4">
        <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <PackageCheck className="h-8 w-8 text-indigo-600" strokeWidth={1.75} />
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-medium text-gray-900 mb-1.5">
          Order Placed
        </h1>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Thank you, {firstName} — we&apos;ve got your order for {order.productTitle} and the retailer is
          preparing it now.
        </p>
      </div>

      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4 border-indigo-100">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-16 w-14 sm:h-20 sm:w-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
            {order.productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.productImage} alt={order.productTitle} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xl">🛍️</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{order.productTitle}</p>
            <p className="text-[11px] text-gray-400 tracking-wide mt-1.5">Order Number</p>
            <p className="text-sm font-semibold text-gray-900 font-mono truncate">#{orderNumber}</p>
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[order.status]} className="text-sm px-3 py-1 shrink-0">
            {STATUS_LABEL[order.status]}
          </Badge>
        </CardContent>
      </Card>

      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardContent className="p-5 grid grid-cols-2 gap-x-4 gap-y-5">
          <Fact icon={Truck} label="Delivery Slot" value={SLOT_LABEL[order.deliverySlot ?? ""] ?? "—"} />
          <Fact icon={PackageCheck} label="Amount" value={formatCurrency(order.amountTotal)} />
          <Fact icon={Wallet} label="Payment Method" value={order.paymentMethod} className="col-span-2" />
        </CardContent>
      </Card>

      <Card className="rounded-3xl overflow-hidden bg-white/90 mb-4">
        <CardHeader className="px-5 pt-4 pb-1">
          <CardTitle className="font-heading text-base font-medium">Your order details</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-2 divide-y divide-gray-50">
          <SummaryRow label="Name" value={order.customer.name} />
          <SummaryRow label="Phone" value={order.customer.phone} />
          {order.customer.email && <SummaryRow label="Email" value={order.customer.email} />}
          <SummaryRow label="Address" value={order.address.line1} />
          <SummaryRow label="Pincode" value={order.address.pincode} />
          {order.address.landmark && <SummaryRow label="Landmark" value={order.address.landmark} />}
          {order.specialInstructions && (
            <SummaryRow label="Special Instructions" value={order.specialInstructions} />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center pb-8">
        This is a mocked order for demo purposes — no invoice has been generated.
      </p>
    </div>
  );
}

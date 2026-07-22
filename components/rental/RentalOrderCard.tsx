"use client";
import { useState } from "react";
import Link from "next/link";
import { LifeBuoy, ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { RentalOrder } from "@/lib/rental/order-types";
import {
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABEL,
  formatDisplayDate,
  getDisplayStatus,
} from "@/lib/rental/order-mock";
import { cancelRentalOrder } from "@/lib/rental/rental-orders-client";

interface RentalOrderCardProps {
  order: RentalOrder;
  /** Called after a real Cancel so the list can refresh from the server. */
  onCancelled: () => void;
}

export function RentalOrderCard({ order, onCancelled }: RentalOrderCardProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const status = getDisplayStatus(order);
  const canCancel = status !== "cancelled" && status !== "completed";
  const orderNumber = order.id.slice(0, 8).toUpperCase();

  async function confirmCancel() {
    setCancelling(true);
    try {
      await cancelRentalOrder(order.id);
      setConfirmingCancel(false);
      onCancelled();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Card className="rounded-2xl overflow-hidden bg-white">
      <div className="flex gap-4 p-4">
        <div className="h-24 w-20 sm:h-28 sm:w-24 rounded-xl overflow-hidden bg-gray-50 shrink-0">
          {order.productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={order.productImage} alt={order.productTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-2xl">🧵</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{order.productTitle}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">#{orderNumber}</p>
            </div>
            <Badge variant={ORDER_STATUS_BADGE_VARIANT[status]} className="shrink-0">
              {ORDER_STATUS_LABEL[status]}
            </Badge>
          </div>

          <p className="text-xs text-gray-500 mt-1.5">Rental Date {formatDisplayDate(order.eventDate)}</p>

          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-sm font-bold text-gray-900">
              {formatCurrency(order.rentalPricePerDay)}
              <span className="text-xs font-normal text-gray-400">/day</span>
            </span>
            <span className="text-xs text-gray-400">Deposit {formatCurrency(order.deposit)}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        {confirmingCancel ? (
          <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl">
            <ShieldOff className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-700 flex-1">Cancel this rental request?</p>
            <button
              onClick={() => setConfirmingCancel(false)}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1"
            >
              Never mind
            </button>
            <button
              onClick={confirmCancel}
              disabled={cancelling}
              className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 disabled:opacity-50"
            >
              Yes, cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link href={`/rent/orders/${order.id}`} className="flex-1">
              <Button size="sm" variant="outline" className="w-full">
                Track
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={!canCancel}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowSupport((v) => !v)}>
              Support
            </Button>
          </div>
        )}

        {showSupport && !confirmingCancel && (
          <div className="flex items-start gap-2.5 mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            <LifeBuoy className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-700">
              Support chat isn&apos;t wired up in this preview yet — this is where you&apos;d reach the
              retailer about order #{orderNumber}.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

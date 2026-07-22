"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { AGE_GROUPS, AgeGroup, AgeRentalQuote, RentalAvailability, RentalInfo } from "@/lib/rental/types";
import { CalendarClock, ShieldCheck, Clock, AlertTriangle, Truck, Home } from "lucide-react";
import { RentalRequestModal } from "./RentalRequestModal";
import { CustomerAddress } from "@/lib/rental/customer-profile";

const AVAILABILITY_BADGE: Record<RentalAvailability, { label: string; variant: "success" | "warning" | "error" }> = {
  available: { label: "Available Now", variant: "success" },
  reserved: { label: "Reserved", variant: "warning" },
  rented_out: { label: "Currently Rented Out", variant: "error" },
};

const DEFAULT_AGE: AgeGroup = "5-6";

interface RentalInfoPanelProps {
  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeName?: string | null;
  /** Static facts (duration, late fee, delivery, home trial) plus the quote for the default age group. */
  initialRental: RentalInfo;
  /**
   * Enables the interactive multi-step Request Rental flow. No auth is
   * required for it yet — omit for the retailer's own read-only preview,
   * where the button stays inert.
   */
  enableRequestFlow?: boolean;
  /** Verified phone from the real OTP session, if the visitor is logged in. */
  sessionPhone?: string;
  /** Server-fetched account/address book for that same logged-in customer — never populated for a guest. */
  initialAccount?: { name: string; email?: string };
  initialAddresses?: CustomerAddress[];
}

export function RentalInfoPanel({
  productId,
  productTitle,
  productImage,
  storeName,
  initialRental,
  enableRequestFlow,
  sessionPhone,
  initialAccount,
  initialAddresses,
}: RentalInfoPanelProps) {
  const [selectedAge, setSelectedAge] = useState<AgeGroup>(DEFAULT_AGE);
  const [quote, setQuote] = useState<AgeRentalQuote>({
    availability: initialRental.availability,
    rentalPricePerDay: initialRental.rentalPricePerDay,
    deposit: initialRental.deposit,
  });
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/public/rental-products/${productId}/availability?age=${selectedAge}`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && !data.error) {
            setQuote({
              availability: data.availability,
              rentalPricePerDay: data.rentalPricePerDay,
              deposit: data.deposit,
            });
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [productId, selectedAge]);

  const availability = AVAILABILITY_BADGE[quote.availability];

  return (
    <Card className="rounded-3xl overflow-hidden bg-white/90 border-indigo-100">
      <CardHeader className="px-4 sm:px-5 pt-3.5 pb-1 flex flex-row items-center justify-between">
        <CardTitle className="font-heading text-base font-medium">Rental Information</CardTitle>
        <Badge variant={availability.variant}>{availability.label}</Badge>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-4 pt-2 space-y-5">
        {/* Age / size selector */}
        <div>
          <p className="text-[10px] font-medium text-gray-400 tracking-wide font-body mb-2">
            Available Sizes (Age Groups)
          </p>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => setSelectedAge(age)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  selectedAge === age
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {age}
              </button>
            ))}
          </div>
        </div>

        {/* Price / deposit — reactive to the selected age group */}
        <div className={`grid grid-cols-2 gap-4 transition-opacity duration-150 ${loading ? "opacity-50" : ""}`}>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
              <CalendarClock className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gray-400 tracking-wide font-body">Rental Price</p>
              <p className="text-sm font-semibold text-gray-900 font-body">
                {formatCurrency(quote.rentalPricePerDay)}{" "}
                <span className="text-gray-400 font-normal">/ day</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gray-400 tracking-wide font-body">Refundable Deposit</p>
              <p className="text-sm font-semibold text-gray-900 font-body">{formatCurrency(quote.deposit)}</p>
            </div>
          </div>
        </div>

        {/* Duration / late fee — same regardless of size */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
              <Clock className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gray-400 tracking-wide font-body">Rental Duration</p>
              <p className="text-sm font-semibold text-gray-900 font-body">
                {initialRental.rentalDurationDays} days
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
              <AlertTriangle className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gray-400 tracking-wide font-body">Late Fee</p>
              <p className="text-sm font-semibold text-gray-900 font-body">
                {formatCurrency(initialRental.lateFeePerDay)} <span className="text-gray-400 font-normal">/ day</span>
              </p>
            </div>
          </div>
        </div>

        {/* Delivery + home trial */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
              <Truck className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-gray-400 tracking-wide font-body">Delivery Information</p>
              <p className="text-sm font-semibold text-gray-900 font-body">{initialRental.deliveryInfo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center">
              <Home className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-gray-400 tracking-wide font-body mb-0.5">
                Home Trial Included
              </p>
              <Badge variant={initialRental.homeTrialIncluded ? "success" : "outline"}>
                {initialRental.homeTrialIncluded ? "Included" : "Not available"}
              </Badge>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={enableRequestFlow ? () => setModalOpen(true) : undefined}
        >
          Request Rental
        </Button>
        <p className="text-[11px] text-gray-400 text-center font-body">
          {enableRequestFlow
            ? "No online payment — pay at your doorstep once the retailer confirms."
            : "This is a preview of the rental listing — no payment is collected yet."}
        </p>
      </CardContent>

      {modalOpen && enableRequestFlow && (
        <RentalRequestModal
          productId={productId}
          productTitle={productTitle}
          productImage={productImage}
          storeName={storeName}
          sessionPhone={sessionPhone}
          initialAccount={initialAccount}
          initialAddresses={initialAddresses}
          ageGroup={selectedAge}
          rentalPricePerDay={quote.rentalPricePerDay}
          deposit={quote.deposit}
          rentalDurationDays={initialRental.rentalDurationDays}
          onClose={() => setModalOpen(false)}
        />
      )}
    </Card>
  );
}

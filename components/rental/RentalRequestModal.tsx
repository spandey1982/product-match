"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowRight, ArrowLeft, User, Phone, Mail, MapPin, Hash, Landmark as LandmarkIcon, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { AgeGroup } from "@/lib/rental/types";
import { DeliverySlot } from "@/lib/rental/order-types";
import {
  computeDeliveryDate,
  computeExpectedTrialWindow,
  formatDisplayDate,
  tomorrowDateInputValue,
} from "@/lib/rental/order-mock";
import { createRentalOrder } from "@/lib/rental/rental-orders-client";
import { CustomerAddress } from "@/lib/rental/customer-profile";

interface RentalRequestModalProps {
  productId: string;
  productTitle: string;
  productImage?: string | null;
  storeName?: string | null;
  ageGroup: AgeGroup;
  rentalPricePerDay: number;
  deposit: number;
  rentalDurationDays: number;
  /** Verified phone from the real OTP session, if the visitor is logged in — prefills Step 1 and disables editing it. */
  sessionPhone?: string;
  /** Only ever populated for a logged-in customer (fetched server-side from their verified session) — a guest never gets someone else's saved data, or a lookup that could leak it. */
  initialAccount?: { name: string; email?: string };
  initialAddresses?: CustomerAddress[];
  onClose: () => void;
}

const STEP_LABELS = ["Customer Details", "Delivery Address", "Rental Details", "Confirmation"];

const SLOTS: { value: DeliverySlot; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

const editInputClass =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none";

/**
 * Multi-step Request Rental wizard. No auth is required to use it — a guest
 * can complete it with just their own details, no lookup of anyone else's
 * saved data (see the security note on initialAddresses above). The
 * resulting order is a real (but still mocked/no-payment) Postgres row now,
 * not a localStorage entry.
 */
export function RentalRequestModal({
  productId,
  productTitle,
  productImage,
  storeName,
  ageGroup,
  rentalPricePerDay,
  deposit,
  rentalDurationDays,
  sessionPhone,
  initialAccount,
  initialAddresses,
  onClose,
}: RentalRequestModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(initialAccount?.name ?? "");
  const [phone, setPhone] = useState(sessionPhone ?? "");
  const [email, setEmail] = useState(initialAccount?.email ?? "");

  const savedAddresses = initialAddresses ?? [];
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    savedAddresses.find((a) => a.isDefault)?.id ?? savedAddresses[0]?.id ?? null
  );
  // Show the "add new address" form directly when there's nothing saved yet (always true for a guest).
  const [addingNewAddress, setAddingNewAddress] = useState(savedAddresses.length === 0);

  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [landmark, setLandmark] = useState("");

  const [eventDate, setEventDate] = useState("");
  const [deliverySlot, setDeliverySlot] = useState<DeliverySlot>("morning");
  const [specialInstructions, setSpecialInstructions] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function validateStep(): string | null {
    if (step === 1) {
      if (!name.trim()) return "Enter your name";
      if (phone.replace(/\D/g, "").length < 10) return "Enter a valid mobile number";
    }
    if (step === 2) {
      if (addingNewAddress) {
        if (!address.trim()) return "Enter your delivery address";
        if (pincode.replace(/\D/g, "").length !== 6) return "Enter a valid 6-digit pincode";
      } else if (!selectedAddressId) {
        return "Select a delivery address";
      }
    }
    if (step === 3) {
      if (!eventDate) return "Select your event date";
    }
    return null;
  }

  function goNext() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  }

  const deliveryDate = eventDate ? computeDeliveryDate(eventDate) : "";
  const expectedTrialWindow = deliveryDate ? computeExpectedTrialWindow(deliveryDate) : "";

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const order = await createRentalOrder({
        productId,
        productTitle,
        productImage,
        storeName,
        ageGroup,
        rentalPricePerDay,
        deposit,
        rentalDurationDays,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        ...(addingNewAddress
          ? { address: address.trim(), pincode: pincode.trim(), landmark: landmark.trim() || undefined }
          : { addressId: selectedAddressId ?? undefined }),
        eventDate,
        deliverySlot,
        specialInstructions: specialInstructions.trim() || undefined,
        deliveryDate,
        expectedTrialWindow,
      });
      router.push(`/rent/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your request");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center justify-center h-8 w-8 rounded-full bg-white/80 border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-white transition-colors shadow-sm"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="mb-6 pr-8">
            <p className="text-xs font-semibold text-indigo-500 mb-2">
              Step {step} of 4 — {STEP_LABELS[step - 1]}
            </p>
            <div className="flex gap-1.5">
              {STEP_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-indigo-600" : "bg-gray-100"}`}
                />
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                leftIcon={<User className="h-4 w-4" />}
                placeholder="Your full name"
                autoFocus
              />
              <Input
                label="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<Phone className="h-4 w-4" />}
                placeholder="10-digit mobile number"
                disabled={Boolean(sessionPhone)}
              />
              <Input
                label="Email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                placeholder="you@example.com"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {!addingNewAddress && savedAddresses.length > 0 ? (
                <>
                  <p className="text-sm font-medium text-gray-700">Deliver to</p>
                  <div className="space-y-2">
                    {savedAddresses.map((saved: CustomerAddress) => (
                      <button
                        key={saved.id}
                        type="button"
                        onClick={() => setSelectedAddressId(saved.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                          selectedAddressId === saved.id
                            ? "border-indigo-500 bg-indigo-50/60"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                            selectedAddressId === saved.id
                              ? "bg-indigo-600 border-indigo-600"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedAddressId === saved.id && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <div className="min-w-0">
                          {saved.label && (
                            <p className="text-xs font-semibold text-gray-900">{saved.label}</p>
                          )}
                          <p className="text-sm text-gray-700">{saved.line1}</p>
                          <p className="text-xs text-gray-400">
                            {saved.pincode}
                            {saved.landmark ? ` · ${saved.landmark}` : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddingNewAddress(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add new address
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Address</label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="House no., street, locality, city"
                      rows={3}
                      className={editInputClass}
                    />
                  </div>
                  <Input
                    label="Pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    leftIcon={<Hash className="h-4 w-4" />}
                    placeholder="6-digit pincode"
                    inputMode="numeric"
                  />
                  <Input
                    label="Landmark (optional)"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    leftIcon={<LandmarkIcon className="h-4 w-4" />}
                    placeholder="Nearby landmark"
                  />
                  {savedAddresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddingNewAddress(false)}
                      className="text-sm text-gray-400 hover:text-gray-600 underline"
                    >
                      Choose a saved address instead
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Input
                label="Event Date"
                type="date"
                value={eventDate}
                min={tomorrowDateInputValue()}
                onChange={(e) => setEventDate(e.target.value)}
                leftIcon={<MapPin className="h-4 w-4" />}
              />
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Preferred Delivery Slot
                </label>
                <div className="flex gap-2">
                  {SLOTS.map((slot) => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setDeliverySlot(slot.value)}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                        deliverySlot === slot.value
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Special Instructions (optional)
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Anything the retailer should know"
                  rows={2}
                  className={editInputClass}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="divide-y divide-gray-100">
              <SummaryRow label="Product" value={productTitle} />
              <SummaryRow label="Age" value={ageGroup} />
              <SummaryRow label="Rental Price" value={`${formatCurrency(rentalPricePerDay)} / day`} />
              <SummaryRow label="Refundable Deposit" value={formatCurrency(deposit)} />
              <SummaryRow label="Delivery Date" value={formatDisplayDate(deliveryDate)} />
              <SummaryRow label="Expected Trial Window" value={expectedTrialWindow} />
              <SummaryRow label="Payment Method" value="Pay at Doorstep" />
            </div>
          )}

          {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <Button variant="outline" onClick={goBack} className="flex-1">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={goNext} className="flex-1">
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={submitting} className="flex-1">
                Place Rental Request
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}

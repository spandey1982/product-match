import { Product } from "@/types";
import { AGE_GROUPS, AgeGroup, AgeRentalQuote, RentalAvailability, RentalInfo } from "./types";

const AVAILABILITY: RentalAvailability[] = ["available", "available", "reserved", "rented_out"];
const DELIVERY_OPTIONS = [
  "Free delivery in 2-3 business days",
  "Express delivery available (1 business day, extra fee)",
  "Standard delivery in 3-5 business days",
];
const DURATIONS = [3, 5, 7];

/** Deterministic string hash so mock data stays stable across renders for a given input. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Deterministic per-(product, age) availability — the single source both getMockRentalInfoForAge and the overall aggregator below read from. */
function getMockAvailabilityForAge(productId: string, age: AgeGroup): RentalAvailability {
  const seed = hashString(`${productId}:${age}`);
  return AVAILABILITY[seed % AVAILABILITY.length];
}

/**
 * Overall availability across every size — "available" as long as at least
 * one age group still has stock, so the list/detail badge never shows
 * "Rented Out" while a customer could still get it in a different size.
 * Falls back to "reserved"/"rented_out" only once no size is available.
 */
function getMockOverallAvailability(productId: string): RentalAvailability {
  const statuses = AGE_GROUPS.map((age) => getMockAvailabilityForAge(productId, age));
  if (statuses.includes("available")) return "available";
  if (statuses.includes("reserved")) return "reserved";
  return "rented_out";
}

/**
 * Rental price/deposit come from the retailer's own entry (Product.
 * rentalPricePerDay / rentalDeposit) whenever set — the formula below is
 * only a fallback for the retailer's own "preview as rental" toggle on a
 * product that isn't actually marked for rent (getMockRentalInfoForAge, used
 * by the public marketplace, is never reached for such a product). The rest
 * (duration, late fee, delivery, home trial) has no real data model yet and
 * stays mocked.
 */
export function getMockRentalInfo(product: Product): RentalInfo {
  const seed = hashString(product.id);
  const rentalPricePerDay =
    product.rentalPricePerDay ?? Math.max(199, Math.round((product.price * 0.08) / 10) * 10);
  const deposit =
    product.rentalDeposit ?? Math.max(500, Math.round((product.price * 0.5) / 50) * 50);

  return {
    rentalPricePerDay,
    deposit,
    availability: getMockOverallAvailability(product.id),
    rentalDurationDays: DURATIONS[seed % DURATIONS.length],
    lateFeePerDay: Math.max(50, Math.round((rentalPricePerDay * 0.25) / 10) * 10),
    deliveryInfo: DELIVERY_OPTIONS[seed % DELIVERY_OPTIONS.length],
    homeTrialIncluded: seed % 2 === 0,
  };
}

/**
 * Age-dependent quote — larger sizes cost marginally more, and availability
 * is tracked independently per size (a product can be rented out in one age
 * group while available in another). Deterministic per (productId, age).
 * `baseRentalPricePerDay`/`baseDeposit` are the retailer's own entered
 * values (Product.rentalPricePerDay / rentalDeposit) — the size multiplier
 * scales those directly, it's no longer derived from the selling price.
 */
export function getMockRentalInfoForAge(
  productId: string,
  baseRentalPricePerDay: number,
  baseDeposit: number,
  age: AgeGroup
): AgeRentalQuote {
  const ageIndex = AGE_GROUPS.indexOf(age);
  const sizeMultiplier = 1 + ageIndex * 0.04;

  return {
    availability: getMockAvailabilityForAge(productId, age),
    rentalPricePerDay: Math.max(199, Math.round((baseRentalPricePerDay * sizeMultiplier) / 10) * 10),
    deposit: Math.max(500, Math.round((baseDeposit * sizeMultiplier) / 50) * 50),
  };
}

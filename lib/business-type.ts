export const BUSINESS_TYPES = [
  { value: "RETAILER", label: "Retailer" },
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "RENTAL_STORE", label: "Rental Store" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export function businessTypeLabel(value: string): string {
  return BUSINESS_TYPES.find((b) => b.value === value)?.label ?? value;
}

export type RentalAvailability = "available" | "reserved" | "rented_out";

/** Child rental sizing runs by age, not the old adult/teen/kids free-text field it replaces. */
export const AGE_GROUPS = [
  "2-3", "3-4", "4-5", "5-6", "6-7", "7-8", "8-9", "9-10", "10-12",
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

/** Facts that don't change with the selected age group. */
export type RentalInfo = {
  rentalPricePerDay: number;
  deposit: number;
  availability: RentalAvailability;
  rentalDurationDays: number;
  lateFeePerDay: number;
  deliveryInfo: string;
  homeTrialIncluded: boolean;
};

/** The subset that DOES change when the shopper picks a different age group. */
export type AgeRentalQuote = {
  availability: RentalAvailability;
  rentalPricePerDay: number;
  deposit: number;
};

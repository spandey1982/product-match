export type BillingOperation =
  | "metadata_extract"
  | "garment_intelligence"
  | "image_gen_1k"
  | "image_gen_2k"
  | "vai_image_gen"
  | "tryon_1k"
  | "fashion_design_analysis"
  | "fashion_design_gen"
  | "voice_search"
  | "ai_review"
  | "auto_catalog_classify"
  | "auto_catalog_verify";

export type TransactionType =
  | "CREDIT"
  | "RESERVE"
  | "DEDUCT"
  | "RELEASE"
  | "ADJUSTMENT"
  | "RESET";

export type WalletStatus = "active" | "frozen";

export interface WalletBalance {
  balanceUsd: number;
  totalCreditsUsd: number;
  usedPercentage: number;
  remainingPercentage: number;
  status: WalletStatus;
}

export interface InsufficientCreditsError {
  insufficientCredits: true;
  required: number;
  available: number;
  remainingPercentage: number;
}

export interface CreditCheckSuccess<T> {
  result: T;
}

export type CreditCheckResult<T> =
  | CreditCheckSuccess<T>
  | InsufficientCreditsError;

export const BILLING_OPERATIONS: readonly BillingOperation[] = [
  "metadata_extract",
  "garment_intelligence",
  "image_gen_1k",
  "image_gen_2k",
  "vai_image_gen",
  "tryon_1k",
  "fashion_design_analysis",
  "fashion_design_gen",
  "voice_search",
  "ai_review",
  "auto_catalog_classify",
  "auto_catalog_verify",
] as const;

export function isBillingOperation(v: unknown): v is BillingOperation {
  return (
    typeof v === "string" &&
    (BILLING_OPERATIONS as readonly string[]).includes(v)
  );
}

export function isCreditBillingEnabled(): boolean {
  return process.env.ENABLE_CREDIT_BILLING === "true";
}

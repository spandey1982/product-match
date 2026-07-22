/**
 * Pure phone-number helpers with zero dependencies — safe to import from
 * client components. lib/customer-auth.ts re-exports these for its existing
 * callers, but never import customer-auth.ts itself from client code: it
 * pulls in next/headers (server-only).
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isValidPhone(raw: string): boolean {
  const digits = normalizePhone(raw);
  return digits.length >= 10 && digits.length <= 15;
}

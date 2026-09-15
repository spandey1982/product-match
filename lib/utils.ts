import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Retailer wallet credits — 1 decimal place for the normal 0.5-increment
 * major-operation prices (1.5, 2.0, ...), but 2 decimals when the value
 * genuinely needs it (garment_intelligence prices at 0.25 so 4 calls sum to
 * exactly 1 credit — naive toFixed(1) would round it to a lying "0.3").
 */
export function formatCredits(credits: number): string {
  const s = credits.toFixed(2);
  return s.endsWith("0") ? s.slice(0, -1) : s;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateSKU(category: string, index: number): string {
  const prefix = category.substring(0, 3).toUpperCase();
  return `${prefix}-${String(index).padStart(4, "0")}`;
}

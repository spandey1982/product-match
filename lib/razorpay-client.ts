"use client";

/**
 * Browser-side Razorpay Checkout helpers shared by every payment flow in
 * this app (retailer wallet top-up, rental booking prepayment) — kept in one
 * place so the `Window.Razorpay` global augmentation is declared exactly
 * once. Declaring it separately in more than one file risks TypeScript
 * treating them as conflicting global declarations.
 */

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color: string };
}

export interface RazorpayCheckoutInstance {
  open: () => void;
}

export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.head.appendChild(script);
  });
}

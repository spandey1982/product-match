import Razorpay from "razorpay";
import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

let instance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay API keys not configured");
  }
  if (!instance) {
    instance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
}

export function isRazorpayConfigured(): boolean {
  return !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

export function getRazorpayKeyId(): string {
  return RAZORPAY_KEY_ID;
}

export interface CreateOrderInput {
  amountInr: number;
  userId: string;
  packLabel?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createRazorpayOrder(input: CreateOrderInput): Promise<RazorpayOrderResult> {
  const rz = getRazorpay();
  const amountPaise = Math.round(input.amountInr * 100);

  const order = await rz.orders.create({
    amount: amountPaise,
    currency: "INR",
    notes: {
      userId: input.userId,
      packLabel: input.packLabel ?? "",
      ...input.notes,
    },
  });

  return {
    id: order.id,
    amount: order.amount as number,
    currency: order.currency,
    status: order.status,
  };
}

/** Verifies the signature the client returns after a successful Checkout payment (HMAC of "orderId|paymentId"). */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!RAZORPAY_KEY_SECRET) return false;

  const body = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(params.signature));
  } catch {
    // Buffer.from throws on non-hex input, or timingSafeEqual throws on
    // mismatched lengths — either way that's an invalid signature.
    return false;
  }
}

/** Verifies the `x-razorpay-signature` header on incoming webhook deliveries against RAZORPAY_WEBHOOK_SECRET. */
export function verifyWebhookSignature(body: string, signature: string, secret?: string): boolean {
  const webhookSecret = secret ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) return false;

  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  } catch {
    return false;
  }
}

export const CREDIT_PACKS = [
  { id: "pack_500", label: "₹500", amountInr: 500 },
  { id: "pack_1000", label: "₹1,000", amountInr: 1000 },
  { id: "pack_2500", label: "₹2,500", amountInr: 2500 },
  { id: "pack_5000", label: "₹5,000", amountInr: 5000 },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { sendOtpSms } from "@/lib/sms/msg91";

export { isValidPhone, normalizePhone };

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-this";

const CUSTOMER_SESSION_COOKIE = "pm_customer_session";
const CUSTOMER_SESSION_DURATION = 60 * 60 * 24 * 30; // 30 days

const OTP_COOKIE = "pm_otp_pending";
const OTP_DURATION = 60 * 5; // 5 minutes

export interface CustomerSession {
  id: string;
  phone: string;
  type: "customer";
}

interface PendingOtp {
  phone: string;
  otp: string;
  type: "otp_pending";
}


function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Issues and delivers an OTP over real SMS via MSG91. The pending OTP is
 * held in a short-lived signed cookie (not a DB table) since it's a
 * 5-minute, single-use value — unchanged from before MSG91 was wired in.
 * Throws if MSG91 delivery fails, so a customer who didn't receive a code
 * sees an error rather than a false "sent" confirmation.
 */
export async function issuePendingOtp(rawPhone: string): Promise<string> {
  const phone = normalizePhone(rawPhone);
  const otp = generateOtp();
  const payload: PendingOtp = { phone, otp, type: "otp_pending" };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: OTP_DURATION });

  const cookieStore = await cookies();
  cookieStore.set(OTP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OTP_DURATION,
    path: "/",
  });

  await sendOtpSms(phone, otp);

  return otp;
}

export async function verifyPendingOtp(rawPhone: string, otp: string): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  const cookieStore = await cookies();
  const token = cookieStore.get(OTP_COOKIE)?.value;
  if (!token) return false;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as PendingOtp;
    return payload.type === "otp_pending" && payload.phone === phone && payload.otp === otp;
  } catch {
    return false;
  }
}

export async function clearPendingOtp(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OTP_COOKIE);
}

export async function setCustomerSession(customer: { id: string; phone: string }): Promise<void> {
  const payload: CustomerSession = { id: customer.id, phone: customer.phone, type: "customer" };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: CUSTOMER_SESSION_DURATION });

  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CUSTOMER_SESSION_DURATION,
    path: "/",
  });
}

/** Distinct cookie + a `type: "customer"` claim so a retailer's session token can never be read as a customer session, or vice versa. */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as CustomerSession;
    return payload.type === "customer" ? payload : null;
  } catch {
    return null;
  }
}

export async function clearCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
}

export async function findOrCreateCustomer(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  const existing = await db.customer.findUnique({ where: { phone } });
  if (existing) return existing;
  return db.customer.create({ data: { phone } });
}

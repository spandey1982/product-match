import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { normalizePhone } from "@/lib/phone";
import { sendOtpSms } from "@/lib/sms/msg91";

/**
 * Retailer-side OTP for phone verification + password-change security
 * actions. Mirrors lib/customer-auth.ts's proven cookie-JWT pattern (a
 * 5-minute single-use OTP held in a signed httpOnly cookie, not a DB
 * table) but scoped to an authenticated User and tagged with a `purpose`
 * so a verify-phone OTP can never be replayed as a password-reset OTP.
 */

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-this";
const OTP_COOKIE = "pm_retailer_otp_pending";
const OTP_DURATION = 60 * 5; // 5 minutes

export type RetailerOtpPurpose = "verify_phone" | "reset_password";

interface PendingRetailerOtp {
  userId: string;
  phone: string;
  otp: string;
  purpose: RetailerOtpPurpose;
  type: "retailer_otp_pending";
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Issues and delivers an OTP over real SMS via MSG91. Throws if delivery fails. */
export async function issueRetailerOtp(
  userId: string,
  rawPhone: string,
  purpose: RetailerOtpPurpose
): Promise<void> {
  const phone = normalizePhone(rawPhone);
  const otp = generateOtp();
  const payload: PendingRetailerOtp = { userId, phone, otp, purpose, type: "retailer_otp_pending" };
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
}

export async function verifyRetailerOtp(
  userId: string,
  otp: string,
  purpose: RetailerOtpPurpose
): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OTP_COOKIE)?.value;
  if (!token) return false;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as PendingRetailerOtp;
    return (
      payload.type === "retailer_otp_pending" &&
      payload.userId === userId &&
      payload.purpose === purpose &&
      payload.otp === otp
    );
  } catch {
    return false;
  }
}

export async function clearRetailerOtp(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OTP_COOKIE);
}

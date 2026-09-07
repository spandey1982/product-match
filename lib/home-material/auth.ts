import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { sendOtpSms } from "@/lib/sms/msg91";

export { isValidPhone, normalizePhone };

// Mirrors lib/customer-auth.ts's proven cookie-JWT pattern (stateless OTP,
// no DB table for the pending code) but scoped to HmUser — a distinct
// identity from Customer/User, per docs/home-material/README.md's locked
// decisions. Distinct cookie names + a `type` claim so an HmUser session
// can never be read as a fashion Customer/retailer session, or vice versa.

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-this";

const HM_SESSION_COOKIE = "pm_hm_session";
const HM_SESSION_DURATION = 60 * 60 * 24 * 30; // 30 days

const HM_OTP_COOKIE = "pm_hm_otp_pending";
const HM_OTP_DURATION = 60 * 5; // 5 minutes

export interface HmUserSession {
  id: string;
  phone: string;
  type: "hm_user";
}

interface PendingHmOtp {
  phone: string;
  otp: string;
  type: "hm_otp_pending";
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Issues and delivers an OTP over real SMS via MSG91. Throws if delivery fails, so a caller who didn't receive a code sees an error rather than a false "sent" confirmation. */
export async function issueHmPendingOtp(rawPhone: string): Promise<void> {
  const phone = normalizePhone(rawPhone);
  const otp = generateOtp();
  const payload: PendingHmOtp = { phone, otp, type: "hm_otp_pending" };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: HM_OTP_DURATION });

  const cookieStore = await cookies();
  cookieStore.set(HM_OTP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: HM_OTP_DURATION,
    path: "/",
  });

  await sendOtpSms(phone, otp);
}

export async function verifyHmPendingOtp(rawPhone: string, otp: string): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  const cookieStore = await cookies();
  const token = cookieStore.get(HM_OTP_COOKIE)?.value;
  if (!token) return false;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as PendingHmOtp;
    return payload.type === "hm_otp_pending" && payload.phone === phone && payload.otp === otp;
  } catch {
    return false;
  }
}

export async function clearHmPendingOtp(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(HM_OTP_COOKIE);
}

export async function setHmUserSession(hmUser: { id: string; phone: string }): Promise<void> {
  const payload: HmUserSession = { id: hmUser.id, phone: hmUser.phone, type: "hm_user" };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: HM_SESSION_DURATION });

  const cookieStore = await cookies();
  cookieStore.set(HM_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: HM_SESSION_DURATION,
    path: "/",
  });
}

export async function getHmUserSession(): Promise<HmUserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(HM_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as HmUserSession;
    return payload.type === "hm_user" ? payload : null;
  } catch {
    return null;
  }
}

export async function clearHmUserSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(HM_SESSION_COOKIE);
}

export async function findOrCreateHmUser(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  const existing = await db.hmUser.findUnique({ where: { phone } });
  if (existing) return existing;
  return db.hmUser.create({ data: { phone } });
}

export async function requireHmUser(): Promise<HmUserSession> {
  const session = await getHmUserSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

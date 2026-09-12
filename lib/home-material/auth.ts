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

const HM_OTP_MESSAGE = (otp: string) =>
  `Your Home Material Intelligence verification code is ${otp}. Do not share this code with anyone.`;

// ─────────────────────────────────────────────────────────────────────────
// TEMPORARY TEST BYPASS — added 2026-09-07, MUST BE REMOVED before any real
// user relies on OTP delivery for this domain.
//
// Reason it exists: the MSG91 account currently has zero SMS balance (see
// [[db-migration-drift-risk]]'s sibling note, or just check
// GET api.msg91.com/api/balance.php?authkey=...&type=4), so real OTP
// delivery is not currently possible to test end-to-end at all. This lets
// local testing continue by short-circuiting delivery for one fixed,
// clearly-fake phone number with a fixed, publicly-known code.
//
// Also gated on NODE_ENV !== "production" as defense in depth, but do not
// rely on that alone — remove this block outright once MSG91 has balance
// again (and, separately, once HM_OTP_MESSAGE has an actual DLT-registered
// template — see lib/sms/msg91.ts's sendOtpSms doc comment).
// ─────────────────────────────────────────────────────────────────────────
const TEST_BYPASS_PHONE = "9876543210";
const TEST_BYPASS_OTP = "000000";

/** Issues and delivers an OTP over real SMS via MSG91. Throws if delivery fails, so a caller who didn't receive a code sees an error rather than a false "sent" confirmation. */
export async function issueHmPendingOtp(rawPhone: string): Promise<void> {
  const phone = normalizePhone(rawPhone);

  if (phone === TEST_BYPASS_PHONE && process.env.NODE_ENV !== "production") {
    const payload: PendingHmOtp = { phone, otp: TEST_BYPASS_OTP, type: "hm_otp_pending" };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: HM_OTP_DURATION });
    const cookieStore = await cookies();
    cookieStore.set(HM_OTP_COOKIE, token, {
      httpOnly: true,
      // Never "production" here — this whole branch is gated on NODE_ENV !== "production" above.
      secure: false,
      sameSite: "lax",
      maxAge: HM_OTP_DURATION,
      path: "/",
    });
    console.log(`[home-material/auth] TEST BYPASS active for ${phone} — no SMS sent, code is ${TEST_BYPASS_OTP}`);
    return;
  }

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

  await sendOtpSms(phone, otp, HM_OTP_MESSAGE(otp));
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

// ─────────────────────────────────────────────────────────────────────────
// OTP GATE REMOVED — TEMPORARY, 2026-09-12. Per the intent-first entry
// review (research/home-material-intent-first-review.html §OTP gate),
// the plan is to reopen this later with OTP required only immediately
// before generation, not at room upload. That re-implementation is
// explicitly deferred until asked for — this is the interim state only.
//
// Every route that used to require a real session now calls this instead
// of getHmUserSession()+401. It transparently provisions a real HmUser
// row with a synthetic, unique, never-dialled "phone" (`guest_<uuid>`,
// impossible to collide with or be mistaken for a verified number) and a
// normal session cookie, so every downstream model relation (HmProject,
// HmRoom, HmShortlistItem, HmLead) keeps working unchanged against a real
// HmUser id — no schema change needed. A returning visitor with an
// existing session (guest or real) is left untouched.
//
// Known limitation, acceptable for a temporary state: near-simultaneous
// first requests before any cookie exists can each provision their own
// guest row (no request coalescing). Revert this function's use (put the
// getHmUserSession()+401 checks back) when the real gate is reinstated.
export async function getOrCreateHmUserSession(): Promise<HmUserSession> {
  const existing = await getHmUserSession();
  if (existing) return existing;

  const guestUser = await db.hmUser.create({ data: { phone: `guest_${crypto.randomUUID()}` } });
  await setHmUserSession(guestUser);
  return { id: guestUser.id, phone: guestUser.phone, type: "hm_user" };
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DELETION_GRACE_PERIOD_MS } from "@/lib/account/purge";
import { issuePasswordResetToken } from "@/lib/password-reset";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email/resend";

// Module-level, per-process — sufficient for a single-instance Railway
// deployment (same rationale as lib/tryon.ts's createRateLimiter). Keyed by
// the submitted email so repeated requests for one account are throttled
// without penalizing other users.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  requestLog.set(key, recent);
  return false;
}

const GENERIC_RESPONSE = {
  ok: true,
  message: "If an account exists for that email, we've sent a password reset link.",
};

// POST /api/auth/forgot-password — unauthenticated. Always responds with the
// same generic message regardless of whether the email matches an account,
// so this endpoint can't be used to enumerate registered emails.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (isRateLimited(email)) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const user = await db.user.findUnique({ where: { email } });

    const pastGracePeriod =
      user?.deletedAt != null && Date.now() - user.deletedAt.getTime() >= DELETION_GRACE_PERIOD_MS;

    if (user && !pastGracePeriod && isEmailConfigured()) {
      const token = await issuePasswordResetToken(user.id);
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/reset-password?token=${token}`;
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (err) {
        // Delivery failure must not leak "this email exists" to the caller —
        // log it server-side and still return the generic response.
        console.error("[forgot-password] email send failed:", err);
      }
    } else if (user && !isEmailConfigured()) {
      console.error("[forgot-password] RESEND_API_KEY is not configured — cannot send reset email.");
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (err) {
    console.error("[forgot-password] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

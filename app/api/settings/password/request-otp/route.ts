import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueRetailerOtp } from "@/lib/retailer-otp";

// POST — send a password-change OTP to the retailer's already-verified phone.
export async function POST() {
  try {
    const session = await requireAuth();

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { phone: true, phoneVerifiedAt: true },
    });
    if (!user?.phone || !user.phoneVerifiedAt) {
      return NextResponse.json({ error: "Verify your phone number first." }, { status: 400 });
    }

    await issueRetailerOtp(session.id, user.phone, "reset_password");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[settings/password/request-otp] error:", err);
    return NextResponse.json({ error: "Could not send OTP. Please try again." }, { status: 500 });
  }
}

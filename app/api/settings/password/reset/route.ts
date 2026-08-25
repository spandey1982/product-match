import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyRetailerOtp, clearRetailerOtp } from "@/lib/retailer-otp";

// POST — verify the OTP and set a new password.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const otp = (body as { otp?: unknown }).otp;
    const newPassword = (body as { newPassword?: unknown }).newPassword;

    if (typeof otp !== "string" || !otp.trim()) {
      return NextResponse.json({ error: "Enter the OTP." }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const valid = await verifyRetailerOtp(session.id, otp.trim(), "reset_password");
    if (!valid) {
      return NextResponse.json({ error: "Incorrect or expired OTP." }, { status: 400 });
    }

    const hashed = await hashPassword(newPassword);
    await db.user.update({
      where: { id: session.id },
      data: { password: hashed },
    });
    await clearRetailerOtp();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[settings/password/reset] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

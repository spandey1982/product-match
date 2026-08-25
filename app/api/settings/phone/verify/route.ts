import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { verifyRetailerOtp, clearRetailerOtp } from "@/lib/retailer-otp";

// POST — verify the OTP and mark the phone as this retailer's verified security phone.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const rawPhone = (body as { phone?: unknown }).phone;
    const otp = (body as { otp?: unknown }).otp;

    if (typeof rawPhone !== "string" || !isValidPhone(rawPhone)) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    if (typeof otp !== "string" || !otp.trim()) {
      return NextResponse.json({ error: "Enter the OTP." }, { status: 400 });
    }

    const valid = await verifyRetailerOtp(session.id, otp.trim(), "verify_phone");
    if (!valid) {
      return NextResponse.json({ error: "Incorrect or expired OTP." }, { status: 400 });
    }

    const phone = normalizePhone(rawPhone);
    const existing = await db.user.findUnique({ where: { phone } });
    if (existing && existing.id !== session.id) {
      return NextResponse.json({ error: "That phone number is already in use on another account." }, { status: 409 });
    }

    await db.user.update({
      where: { id: session.id },
      data: { phone, phoneVerifiedAt: new Date() },
    });
    await clearRetailerOtp();

    return NextResponse.json({ phone });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[settings/phone/verify] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

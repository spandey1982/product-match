import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { issueRetailerOtp } from "@/lib/retailer-otp";

// POST — send an OTP to a phone number the retailer wants to verify/add to their own account.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const rawPhone = (body as { phone?: unknown }).phone;

    if (typeof rawPhone !== "string" || !isValidPhone(rawPhone)) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }

    const phone = normalizePhone(rawPhone);
    const existing = await db.user.findUnique({ where: { phone } });
    if (existing && existing.id !== session.id) {
      return NextResponse.json({ error: "That phone number is already in use on another account." }, { status: 409 });
    }

    await issueRetailerOtp(session.id, phone, "verify_phone");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[settings/phone/request-otp] error:", err);
    return NextResponse.json({ error: "Could not send OTP. Please try again." }, { status: 500 });
  }
}

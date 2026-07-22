import { NextRequest, NextResponse } from "next/server";
import { isValidPhone, issuePendingOtp } from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });
    }

    const otp = await issuePendingOtp(phone);

    // Mocked delivery: no SMS provider is configured, so the OTP is returned
    // directly instead of being texted. Replace with a real provider call
    // before this reaches production, and stop returning `otp` here.
    return NextResponse.json({ otp });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

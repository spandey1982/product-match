import { NextRequest, NextResponse } from "next/server";
import { isValidPhone, issueHmPendingOtp } from "@/lib/home-material/auth";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });
    }

    await issueHmPendingOtp(phone);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not send OTP. Please try again." }, { status: 500 });
  }
}

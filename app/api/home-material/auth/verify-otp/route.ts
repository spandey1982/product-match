import { NextRequest, NextResponse } from "next/server";
import {
  clearHmPendingOtp,
  findOrCreateHmUser,
  isValidPhone,
  setHmUserSession,
  verifyHmPendingOtp,
} from "@/lib/home-material/auth";

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !isValidPhone(phone) || !otp) {
      return NextResponse.json({ error: "Phone and OTP are required" }, { status: 400 });
    }

    const valid = await verifyHmPendingOtp(phone, otp);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect or expired OTP" }, { status: 401 });
    }

    const hmUser = await findOrCreateHmUser(phone);
    await setHmUserSession({ id: hmUser.id, phone: hmUser.phone });
    await clearHmPendingOtp();

    return NextResponse.json({ hmUser: { id: hmUser.id, phone: hmUser.phone } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

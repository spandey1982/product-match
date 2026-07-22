import { NextRequest, NextResponse } from "next/server";
import {
  clearPendingOtp,
  findOrCreateCustomer,
  isValidPhone,
  setCustomerSession,
  verifyPendingOtp,
} from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !isValidPhone(phone) || !otp) {
      return NextResponse.json({ error: "Phone and OTP are required" }, { status: 400 });
    }

    const valid = await verifyPendingOtp(phone, otp);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect or expired OTP" }, { status: 401 });
    }

    const customer = await findOrCreateCustomer(phone);
    await setCustomerSession({ id: customer.id, phone: customer.phone });
    await clearPendingOtp();

    return NextResponse.json({ customer: { id: customer.id, phone: customer.phone } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

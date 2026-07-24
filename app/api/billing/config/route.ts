import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  isRazorpayConfigured,
  getRazorpayKeyId,
  CREDIT_PACKS,
} from "@/lib/billing/razorpay";

export async function GET() {
  try {
    await requireAuth();

    return NextResponse.json({
      enabled: isRazorpayConfigured(),
      keyId: isRazorpayConfigured() ? getRazorpayKeyId() : null,
      packs: CREDIT_PACKS,
      customMinInr: 100,
      customMaxInr: 100000,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

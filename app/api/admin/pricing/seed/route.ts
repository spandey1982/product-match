import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { seedPilotPricing } from "@/lib/billing/seed-pricing";

export async function POST() {
  try {
    const admin = await requireAdmin();
    const config = await seedPilotPricing(admin.id);

    return NextResponse.json({
      success: true,
      config: { ...config, prices: JSON.parse(config.prices) },
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

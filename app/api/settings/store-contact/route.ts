import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_PHONE_LENGTH = 30;
const MAX_ADDRESS_LENGTH = 300;

// GET — this retailer's current store contact/address (shown to shoppers on /rent)
export async function GET() {
  try {
    const session = await requireAuth();
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { storePhone: true, storeAddress: true },
    });
    return NextResponse.json({
      storePhone: user?.storePhone ?? "",
      storeAddress: user?.storeAddress ?? "",
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update this retailer's store contact/address
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const rawPhone = (body as { storePhone?: unknown }).storePhone;
    const rawAddress = (body as { storeAddress?: unknown }).storeAddress;

    if (typeof rawPhone !== "string" || typeof rawAddress !== "string") {
      return NextResponse.json(
        { error: "storePhone and storeAddress must be strings." },
        { status: 400 }
      );
    }

    const storePhone = rawPhone.trim();
    const storeAddress = rawAddress.trim();

    if (storePhone.length > MAX_PHONE_LENGTH) {
      return NextResponse.json(
        { error: `Phone number must be ${MAX_PHONE_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }
    if (storeAddress.length > MAX_ADDRESS_LENGTH) {
      return NextResponse.json(
        { error: `Address must be ${MAX_ADDRESS_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: session.id },
      data: {
        storePhone: storePhone || null,
        storeAddress: storeAddress || null,
      },
    });

    return NextResponse.json({ storePhone, storeAddress });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

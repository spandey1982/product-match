import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { label, line1, pincode, landmark } = await req.json();
    if (!line1 || !pincode) {
      return NextResponse.json({ error: "Address and pincode are required" }, { status: 400 });
    }

    const existingCount = await db.customerAddress.count({ where: { customerId: session.id } });

    const address = await db.customerAddress.create({
      data: {
        customerId: session.id,
        label: label || null,
        line1,
        pincode,
        landmark: landmark || null,
        // First address a customer saves becomes their default automatically.
        isDefault: existingCount === 0,
      },
    });

    return NextResponse.json({ address }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

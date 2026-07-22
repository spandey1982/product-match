import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AGE_GROUPS, AgeGroup } from "@/lib/rental/types";
import { getMockRentalInfoForAge } from "@/lib/rental/mock-data";

/**
 * Public, unauthenticated — returns the age-specific rental quote (availability,
 * rental price, deposit) for the PDP's age/size selector. Everything else on
 * the Rental Information panel (duration, late fee, delivery, home trial) is
 * static per product and doesn't need a round trip.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const age = searchParams.get("age");

    if (!age || !(AGE_GROUPS as readonly string[]).includes(age)) {
      return NextResponse.json({ error: "Invalid age group" }, { status: 400 });
    }

    const product = await db.product.findFirst({
      where: { id, isActive: true },
      select: { id: true, price: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      getMockRentalInfoForAge(product.id, product.price, age as AgeGroup)
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

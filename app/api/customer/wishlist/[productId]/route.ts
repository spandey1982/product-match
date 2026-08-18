import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";

// DELETE — remove a product from this customer's wishlist. Idempotent: removing something not saved is a no-op, not an error.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in to manage your wishlist." }, { status: 401 });
    }

    const { productId } = await params;

    await db.wishlist.deleteMany({
      where: { customerId: session.id, productId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

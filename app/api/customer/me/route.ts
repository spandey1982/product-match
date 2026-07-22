import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";

/** Updates the logged-in customer's name/email. Phone is the verified session identity — never editable here. */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, email } = await req.json();

    const customer = await db.customer.update({
      where: { id: session.id },
      data: {
        name: typeof name === "string" ? name.trim() : undefined,
        email: typeof email === "string" ? email.trim() || null : undefined,
      },
      select: { id: true, name: true, phone: true, email: true },
    });

    return NextResponse.json({
      customer: { name: customer.name ?? "", phone: customer.phone, email: customer.email ?? undefined },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

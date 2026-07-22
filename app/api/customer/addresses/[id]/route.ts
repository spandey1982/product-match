import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const existing = await db.customerAddress.findFirst({ where: { id, customerId: session.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();

    if (body.isDefault === true) {
      // Only one default address per customer.
      await db.customerAddress.updateMany({
        where: { customerId: session.id },
        data: { isDefault: false },
      });
    }

    const address = await db.customerAddress.update({
      where: { id },
      data: {
        label: body.label !== undefined ? body.label || null : undefined,
        line1: body.line1 !== undefined ? body.line1 : undefined,
        pincode: body.pincode !== undefined ? body.pincode : undefined,
        landmark: body.landmark !== undefined ? body.landmark || null : undefined,
        isDefault: body.isDefault !== undefined ? body.isDefault : undefined,
      },
    });

    return NextResponse.json({ address });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const existing = await db.customerAddress.findFirst({ where: { id, customerId: session.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.customerAddress.delete({ where: { id } });

    // Promote another address to default if we just deleted the default one.
    if (existing.isDefault) {
      const next = await db.customerAddress.findFirst({
        where: { customerId: session.id },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        await db.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

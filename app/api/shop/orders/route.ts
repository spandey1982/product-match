import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession, findOrCreateCustomer, isValidPhone } from "@/lib/customer-auth";
import { toShopOrderDTO } from "@/lib/shop/order-db";
import { rewardCreditsForOrder } from "@/lib/vto-credits/packages";

/**
 * Creates a /shop purchase order — same guest-or-logged-in trust model as
 * /api/customer/rental-orders: a logged-in customer's identity always comes
 * from the session, never the body; only a guest's self-declared phone is
 * trusted. Payment stays "Pay at Doorstep" (mocked, no live gateway) for
 * Phase 1, matching how RentalOrder ships today. Awards the ₹500-per-credit
 * reward (lib/vto-credits/packages.ts) on successful creation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productId,
      productTitle,
      productImage,
      storeName,
      unitPrice,
      name,
      phone,
      email,
      addressId,
      address,
      pincode,
      landmark,
      deliverySlot,
      specialInstructions,
    } = body;

    if (!productId || !productTitle || !name || !deliverySlot || typeof unitPrice !== "number" || unitPrice <= 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const session = await getCustomerSession();

    let customerId: string;
    let resolvedPhone: string;

    if (session) {
      customerId = session.id;
      resolvedPhone = session.phone;
    } else {
      if (!phone || !isValidPhone(phone)) {
        return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });
      }
      const customer = await findOrCreateCustomer(phone);
      customerId = customer.id;
      resolvedPhone = customer.phone;
    }

    await db.customer.update({
      where: { id: customerId },
      data: {
        name: String(name).trim(),
        email: email ? String(email).trim() : undefined,
      },
    });

    let finalAddress: { line1: string; pincode: string; landmark: string | null };

    if (addressId) {
      const saved = await db.customerAddress.findFirst({ where: { id: addressId, customerId } });
      if (!saved) {
        return NextResponse.json({ error: "Address not found" }, { status: 400 });
      }
      finalAddress = { line1: saved.line1, pincode: saved.pincode, landmark: saved.landmark };
    } else {
      if (!address || !pincode) {
        return NextResponse.json({ error: "Address and pincode are required" }, { status: 400 });
      }
      const existingCount = await db.customerAddress.count({ where: { customerId } });
      const created = await db.customerAddress.create({
        data: {
          customerId,
          line1: address,
          pincode,
          landmark: landmark || null,
          isDefault: existingCount === 0,
        },
      });
      finalAddress = { line1: created.line1, pincode: created.pincode, landmark: created.landmark };
    }

    const amountTotal = unitPrice; // quantity is fixed at 1 for Phase 1 — no size/variant selection exists yet.

    const order = await db.shopOrder.create({
      data: {
        customerId,
        orderType: "buy",
        productId,
        productTitle,
        productImage: productImage || null,
        storeName: storeName || null,
        quantity: 1,
        unitPrice,
        amountTotal,
        customerName: String(name).trim(),
        customerPhone: resolvedPhone,
        customerEmail: email ? String(email).trim() : null,
        addressLine1: finalAddress.line1,
        addressPincode: finalAddress.pincode,
        addressLandmark: finalAddress.landmark,
        deliverySlot,
        specialInstructions: specialInstructions || null,
        paymentMethod: "Pay at Doorstep",
        status: "requested",
      },
    });

    const bonusCredits = rewardCreditsForOrder(amountTotal);
    if (bonusCredits > 0) {
      await db.$transaction([
        db.customer.update({ where: { id: customerId }, data: { tryOnCredits: { increment: bonusCredits } } }),
        db.creditTopUp.create({
          data: { customerId, credits: bonusCredits, source: "reward", orderId: order.id },
        }),
      ]);
    }

    return NextResponse.json({ order: toShopOrderDTO(order), bonusCredits }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

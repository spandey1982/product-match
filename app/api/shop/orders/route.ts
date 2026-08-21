import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession, findOrCreateCustomer, isValidPhone } from "@/lib/customer-auth";
import { toShopOrderDTO } from "@/lib/shop/order-db";
import { rewardCreditsForOrder } from "@/lib/vto-credits/packages";

const PHONE_RE = /^\d{10}$/;
const PINCODE_RE = /^\d{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates a /shop order — either a plain "buy" purchase, or a "trial"
 * request from the "Try & Buy" home-trial flow (HomeTrialRequestModal). Same
 * guest-or-logged-in trust model as /api/customer/rental-orders: a
 * logged-in customer's identity always comes from the session, never the
 * body; only a guest's self-declared phone is trusted. Payment stays "Pay at
 * Doorstep" (mocked, no live gateway) for Phase 1, matching how RentalOrder
 * ships today. Awards the ₹500-per-credit reward (lib/vto-credits/packages.ts)
 * on successful creation of either order kind.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderType,
      productId,
      productTitle,
      productImage,
      storeName,
      size,
      unitPrice,
      name,
      phone,
      email,
      addressId,
      address,
      pincode,
      landmark,
      deliverySlot,
      trialDate,
      trialSlot,
      specialInstructions,
    } = body;

    const isTrial = orderType === "trial";

    if (!productId || !productTitle || !name || typeof unitPrice !== "number" || unitPrice <= 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (isTrial) {
      // Stricter than the buy branch's phone check below (exact 10 digits, not
      // "at least 10") and requires an explicit trial date/slot instead of a
      // delivery slot — same posture as this flow's original standalone route.
      if (!trialDate || !trialSlot) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      if (email && !EMAIL_RE.test(String(email).trim())) {
        return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
      }
    } else if (!deliverySlot) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const session = await getCustomerSession();

    let customerId: string;
    let resolvedPhone: string;

    if (session) {
      customerId = session.id;
      resolvedPhone = session.phone;
    } else if (isTrial) {
      if (!phone || !PHONE_RE.test(String(phone).trim())) {
        return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
      }
      const customer = await findOrCreateCustomer(phone);
      customerId = customer.id;
      resolvedPhone = customer.phone;
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
      if (isTrial ? !address || !pincode || !PINCODE_RE.test(String(pincode).trim()) : !address || !pincode) {
        return NextResponse.json(
          { error: isTrial ? "Address and a valid 6-digit pincode are required" : "Address and pincode are required" },
          { status: 400 }
        );
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
        orderType: isTrial ? "trial" : "buy",
        productId,
        productTitle,
        productImage: productImage || null,
        storeName: storeName || null,
        size: isTrial ? size || null : null,
        quantity: 1,
        unitPrice,
        amountTotal,
        customerName: String(name).trim(),
        customerPhone: resolvedPhone,
        customerEmail: email ? String(email).trim() : null,
        addressLine1: finalAddress.line1,
        addressPincode: finalAddress.pincode,
        addressLandmark: finalAddress.landmark,
        deliverySlot: isTrial ? null : deliverySlot,
        trialDate: isTrial ? trialDate : null,
        trialSlot: isTrial ? trialSlot : null,
        specialInstructions: specialInstructions || null,
        paymentMethod: "Pay at Doorstep",
        status: "requested",
      },
    });

    // Trial requests aren't a completed purchase yet — no reward credits until
    // the delivery-person verification (app/deliver/[id]) confirms one.
    const bonusCredits = isTrial ? 0 : rewardCreditsForOrder(amountTotal);
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

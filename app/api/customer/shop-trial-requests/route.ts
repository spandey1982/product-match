import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession, findOrCreateCustomer } from "@/lib/customer-auth";
import { toShopTrialRequestDTO } from "@/lib/shop/trial-request-db";

const PHONE_RE = /^\d{10}$/;
const PINCODE_RE = /^\d{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates a home-trial request for /shop's "Try & Buy" flow. Mirrors
 * app/api/customer/rental-orders/route.ts's guest-or-session identity
 * resolution and address handling, trimmed to this flow's fields — see
 * ShopTrialRequest in prisma/schema.prisma. Deliberately stricter than the
 * rental route's phone check (exact 10 digits, not "at least 10") per this
 * flow's own validation requirements.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productId,
      productTitle,
      productImage,
      storeName,
      price,
      size,
      name,
      phone,
      email,
      addressId,
      address,
      pincode,
      landmark,
      trialDate,
      trialSlot,
      specialInstructions,
    } = body;

    if (!productId || !productTitle || price == null || !name || !trialDate || !trialSlot) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (email && !EMAIL_RE.test(String(email).trim())) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const session = await getCustomerSession();

    let customerId: string;
    let resolvedPhone: string;

    if (session) {
      customerId = session.id;
      resolvedPhone = session.phone;
    } else {
      if (!phone || !PHONE_RE.test(String(phone).trim())) {
        return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
      }
      const customer = await findOrCreateCustomer(phone);
      customerId = customer.id;
      resolvedPhone = customer.phone;
    }

    // Keep the Customer record's own name/email fresh too.
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
      if (!address || !pincode || !PINCODE_RE.test(String(pincode).trim())) {
        return NextResponse.json({ error: "Address and a valid 6-digit pincode are required" }, { status: 400 });
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

    const trialRequest = await db.shopTrialRequest.create({
      data: {
        customerId,
        productId,
        productTitle,
        productImage: productImage || null,
        storeName: storeName || null,
        price,
        size: size || null,
        customerName: String(name).trim(),
        customerPhone: resolvedPhone,
        customerEmail: email ? String(email).trim() : null,
        addressLine1: finalAddress.line1,
        addressPincode: finalAddress.pincode,
        addressLandmark: finalAddress.landmark,
        trialDate,
        trialSlot,
        specialInstructions: specialInstructions || null,
        paymentMethod: "Pay at Doorstep",
        status: "requested",
      },
    });

    return NextResponse.json({ trialRequest: toShopTrialRequestDTO(trialRequest) }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

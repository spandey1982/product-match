import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession, findOrCreateCustomer, isValidPhone } from "@/lib/customer-auth";
import { toRentalOrderDTO } from "@/lib/rental/order-db";

/**
 * Creates a mocked rental request. Works for both a logged-in customer and a
 * guest — but identity is never taken from the request body when a session
 * exists: the session's own customerId is authoritative, so a logged-in
 * visitor can't attribute an order to a phone number they don't own by
 * editing the payload. Only an unauthenticated guest's self-declared phone
 * is trusted (same trust level the old localStorage version had for guests).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productId,
      productTitle,
      productImage,
      storeName,
      ageGroup,
      rentalPricePerDay,
      deposit,
      rentalDurationDays,
      name,
      phone,
      email,
      addressId,
      address,
      pincode,
      landmark,
      eventDate,
      deliverySlot,
      specialInstructions,
      deliveryDate,
      expectedTrialWindow,
    } = body;

    if (!productId || !productTitle || !name || !eventDate || !deliverySlot || !deliveryDate) {
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

    const order = await db.rentalOrder.create({
      data: {
        customerId,
        productId,
        productTitle,
        productImage: productImage || null,
        storeName: storeName || null,
        ageGroup,
        rentalPricePerDay,
        deposit,
        rentalDurationDays,
        customerName: String(name).trim(),
        customerPhone: resolvedPhone,
        customerEmail: email ? String(email).trim() : null,
        addressLine1: finalAddress.line1,
        addressPincode: finalAddress.pincode,
        addressLandmark: finalAddress.landmark,
        eventDate,
        deliverySlot,
        specialInstructions: specialInstructions || null,
        deliveryDate,
        expectedTrialWindow,
        paymentMethod: "Pay at Doorstep",
        status: "requested",
      },
    });

    return NextResponse.json({ order: toRentalOrderDTO(order) }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

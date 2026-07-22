import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSession } from "@/lib/auth";
import { BUSINESS_TYPES, BusinessType } from "@/lib/business-type";

const VALID_BUSINESS_TYPES = BUSINESS_TYPES.map((b) => b.value) as BusinessType[];

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, storeName, businessType } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashed = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        password: hashed,
        name,
        storeName,
        businessType: VALID_BUSINESS_TYPES.includes(businessType) ? businessType : "RETAILER",
      },
    });

    await setSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      storeName: user.storeName,
      businessType: user.businessType,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        storeName: user.storeName,
        businessType: user.businessType,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

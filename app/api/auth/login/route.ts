import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSession } from "@/lib/auth";
import { DELETION_GRACE_PERIOD_MS } from "@/lib/account/purge";

const DEMO_EMAIL = "demo@productmatch.ai";
const DEMO_PASSWORD = "demo1234";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Demo user shortcut
    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      let demo = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
      if (!demo) {
        const { hashPassword } = await import("@/lib/auth");
        demo = await db.user.create({
          data: {
            email: DEMO_EMAIL,
            password: await hashPassword(DEMO_PASSWORD),
            name: "Demo Retailer",
            storeName: "Elegance Boutique",
          },
        });
      }
      await setSession({
        id: demo.id,
        email: demo.email,
        name: demo.name,
        role: demo.role,
        storeName: demo.storeName,
        businessType: demo.businessType,
      });
      return NextResponse.json({
        user: {
          id: demo.id,
          email: demo.email,
          name: demo.name,
          storeName: demo.storeName,
          businessType: demo.businessType,
        },
      });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // An account past its 7-day deletion grace period is effectively gone —
    // treat it the same as "no such user" rather than leaking deletion state.
    const pastGracePeriod =
      user.deletedAt !== null && Date.now() - user.deletedAt.getTime() >= DELETION_GRACE_PERIOD_MS;
    if (pastGracePeriod) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // A correct login within the grace period is the recovery action —
    // cancel the pending deletion.
    const recovered = user.deletedAt !== null;
    if (recovered) {
      await db.user.update({ where: { id: user.id }, data: { deletedAt: null } });
    }

    await setSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      storeName: user.storeName,
      businessType: user.businessType,
    });

    return NextResponse.json({
      recovered,
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

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET — whether this store's products currently show on /shop
export async function GET() {
  try {
    const session = await requireAuth();
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { showOnShop: true },
    });
    return NextResponse.json({ showOnShop: user?.showOnShop ?? true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — toggle whether this store's products show on /shop
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const showOnShop = (body as { showOnShop?: unknown }).showOnShop;

    if (typeof showOnShop !== "boolean") {
      return NextResponse.json(
        { error: "showOnShop must be a boolean." },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: session.id },
      data: { showOnShop },
    });

    return NextResponse.json({ showOnShop });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

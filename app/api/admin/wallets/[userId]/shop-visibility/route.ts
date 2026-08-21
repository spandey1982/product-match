import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH — admin override of a store's /shop visibility. Not retailer-facing
// (that control is hidden for now) — see User.showOnShop in schema.prisma.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await params;
    const body = await req.json().catch(() => ({}));
    const showOnShop = (body as { showOnShop?: unknown }).showOnShop;

    if (typeof showOnShop !== "boolean") {
      return NextResponse.json(
        { error: "showOnShop must be a boolean." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.user.update({
      where: { id: userId },
      data: { showOnShop },
    });

    return NextResponse.json({ showOnShop });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

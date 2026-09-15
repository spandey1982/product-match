import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();

    const users = await db.user.findMany({
      where: { role: "RETAILER" },
      select: {
        id: true,
        name: true,
        email: true,
        storeName: true,
        showOnShop: true,
        wallet: {
          select: {
            id: true,
            balanceCredits: true,
            totalCredits: true,
            status: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const wallets = users.map((u) => {
      const w = u.wallet;
      const usedCredits = w ? w.totalCredits - w.balanceCredits : 0;
      const remainingPct = w && w.totalCredits > 0
        ? Math.round((w.balanceCredits / w.totalCredits) * 100)
        : 0;

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        storeName: u.storeName,
        showOnShop: u.showOnShop,
        wallet: w
          ? {
              id: w.id,
              balanceCredits: w.balanceCredits,
              totalCredits: w.totalCredits,
              usedCredits,
              remainingPercentage: remainingPct,
              status: w.status,
              lastUpdated: w.updatedAt,
            }
          : null,
      };
    });

    return NextResponse.json({ wallets });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

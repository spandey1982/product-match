import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { BILLING_OPERATIONS, type BillingOperation } from "@/lib/billing/types";

function parseOperationFromDescription(desc: string): BillingOperation | "other" {
  const normalized = desc.replace(/^\d+×\s*/, "").trim();
  for (const op of BILLING_OPERATIONS) {
    if (normalized === op || normalized.startsWith(op + " ")) return op;
  }
  return "other";
}

function parseCountFromDescription(desc: string): number {
  const match = desc.match(/^(\d+)×/);
  return match ? parseInt(match[1], 10) : 1;
}

const OPERATION_LABELS: Record<string, string> = {
  metadata_extract: "Metadata Extract",
  garment_intelligence: "Garment Intelligence",
  image_gen_1k: "Image Gen (1K)",
  image_gen_2k: "Image Gen (2K)",
  vai_image_gen: "Vertex Image Gen",
  tryon_1k: "Try-On (1K)",
  fashion_design_analysis: "Design Analysis",
  fashion_design_gen: "Design Generation",
  voice_search: "Voice Search",
  ai_review: "AI Review",
  auto_catalog_classify: "Auto Classify",
  auto_catalog_verify: "Auto Verify",
  other: "Other",
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const storeUserId = url.searchParams.get("store");

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const walletWhere: Record<string, unknown> = {};
    if (storeUserId) {
      const wallet = await db.wallet.findUnique({ where: { userId: storeUserId } });
      if (!wallet) {
        return NextResponse.json({ operations: [], daily: [], totals: { spent: 0, calls: 0 }, stores: [] });
      }
      walletWhere.walletId = wallet.id;
    }

    const [deductions, stores] = await Promise.all([
      db.walletTransaction.findMany({
        where: {
          type: "DEDUCT",
          ...walletWhere,
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: "asc" },
        select: { amountUsd: true, description: true, createdAt: true, walletId: true },
      }),
      db.user.findMany({
        where: { role: "RETAILER", wallet: { isNot: null } },
        select: { id: true, storeName: true, name: true },
        orderBy: { storeName: "asc" },
      }),
    ]);

    const opMap = new Map<string, { calls: number; spent: number; label: string }>();
    const dayMap = new Map<string, { calls: number; spent: number }>();

    let totalSpent = 0;
    let totalCalls = 0;

    for (const tx of deductions) {
      const op = parseOperationFromDescription(tx.description);
      const count = parseCountFromDescription(tx.description);
      const spent = Math.abs(tx.amountUsd);

      const existing = opMap.get(op) ?? { calls: 0, spent: 0, label: OPERATION_LABELS[op] ?? op };
      existing.calls += count;
      existing.spent += spent;
      opMap.set(op, existing);

      const day = tx.createdAt.toISOString().slice(0, 10);
      const dayEntry = dayMap.get(day) ?? { calls: 0, spent: 0 };
      dayEntry.calls += count;
      dayEntry.spent += spent;
      dayMap.set(day, dayEntry);

      totalSpent += spent;
      totalCalls += count;
    }

    const operations = Array.from(opMap.entries())
      .map(([id, data]) => ({
        id,
        label: data.label,
        calls: data.calls,
        spent: parseFloat(data.spent.toFixed(6)),
      }))
      .sort((a, b) => b.spent - a.spent);

    const daily = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        calls: data.calls,
        spent: parseFloat(data.spent.toFixed(6)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      operations,
      daily,
      totals: {
        spent: parseFloat(totalSpent.toFixed(6)),
        calls: totalCalls,
      },
      stores: stores.map((s) => ({ id: s.id, label: s.storeName || s.name })),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

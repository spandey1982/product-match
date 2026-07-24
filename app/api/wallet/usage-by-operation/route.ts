import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletByUserId } from "@/lib/billing/wallet";
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
    const session = await requireAuth();
    const wallet = await getWalletByUserId(session.id);
    if (!wallet) {
      return NextResponse.json({ operations: [], totals: { spent: 0, calls: 0 } });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const deductions = await db.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        type: "DEDUCT",
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      select: { amountUsd: true, description: true },
    });

    const opMap = new Map<string, { calls: number; spent: number; label: string }>();
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

    return NextResponse.json({
      operations,
      totals: { spent: parseFloat(totalSpent.toFixed(6)), calls: totalCalls },
      exchangeRate: wallet.lastExchangeRate,
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

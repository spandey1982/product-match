import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Internal AI cost/usage API (owners/admins only). Returns either aggregated
 * cost analytics (default) or a CSV export of raw events (?format=csv). Not
 * exposed to retailers/customers — guarded by requireAdmin().
 */

function mapError(err: unknown): NextResponse | null {
  const msg = (err as Error).message;
  if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Build a since-Date from a `days` query param (default 30, max 365). */
function sinceFromDays(param: string | null): Date {
  const days = Math.min(Math.max(parseInt(param || "30", 10) || 30, 1), 365);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const CSV_COLUMNS = [
  "id", "createdAt", "provider", "model", "feature", "operation",
  "inputTokens", "outputTokens", "totalTokens", "imagesGenerated", "imageInputs",
  "requestBytes", "responseBytes", "durationMs", "estimatedCostUsd", "pricingVersion",
  "storeId", "userId", "productId", "status", "errorMessage",
] as const;

/** Escape one CSV cell (RFC-4180-ish: quote when it contains , " or newline). */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const since = sinceFromDays(searchParams.get("days"));

    // ── CSV export of raw events ──────────────────────────────────────────
    if (searchParams.get("format") === "csv") {
      const limit = Math.min(parseInt(searchParams.get("limit") || "5000", 10) || 5000, 50000);
      const rows = await db.aiUsageEvent.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      const header = CSV_COLUMNS.join(",");
      const body = rows
        .map((r) => CSV_COLUMNS.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","))
        .join("\n");
      const csv = `${header}\n${body}\n`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ai-usage-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // ── Aggregated analytics ──────────────────────────────────────────────
    const where = { createdAt: { gte: since } };

    const [totals, byProviderModel, byFeature, byStore, recent] = await Promise.all([
      db.aiUsageEvent.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          estimatedCostUsd: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          imagesGenerated: true,
        },
      }),
      db.aiUsageEvent.groupBy({
        by: ["provider", "model"],
        where,
        _count: { _all: true },
        _sum: { estimatedCostUsd: true, totalTokens: true, imagesGenerated: true },
      }),
      db.aiUsageEvent.groupBy({
        by: ["feature"],
        where,
        _count: { _all: true },
        _sum: { estimatedCostUsd: true, imagesGenerated: true },
      }),
      db.aiUsageEvent.groupBy({
        by: ["storeId"],
        where,
        _count: { _all: true },
        _sum: { estimatedCostUsd: true },
      }),
      db.aiUsageEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, createdAt: true, provider: true, model: true, feature: true,
          totalTokens: true, imagesGenerated: true, durationMs: true,
          estimatedCostUsd: true, storeId: true, status: true,
        },
      }),
    ]);

    const errorCount = await db.aiUsageEvent.count({ where: { ...where, status: "error" } });

    return NextResponse.json({
      sinceDays: Math.round((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000)),
      totals: {
        events: totals._count._all,
        errors: errorCount,
        estimatedCostUsd: totals._sum.estimatedCostUsd ?? 0,
        inputTokens: totals._sum.inputTokens ?? 0,
        outputTokens: totals._sum.outputTokens ?? 0,
        totalTokens: totals._sum.totalTokens ?? 0,
        imagesGenerated: totals._sum.imagesGenerated ?? 0,
      },
      byProviderModel,
      byFeature,
      byStore,
      recent,
    });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

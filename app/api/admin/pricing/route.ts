import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { BILLING_OPERATIONS, isBillingOperation } from "@/lib/billing/types";

export async function GET() {
  try {
    await requireAdmin();

    const configs = await db.pricingConfig.findMany({
      orderBy: { effectiveFrom: "desc" },
      take: 20,
    });

    const parsed = configs.map((c) => ({
      ...c,
      prices: JSON.parse(c.prices) as Record<string, number>,
    }));

    return NextResponse.json({ configs: parsed, availableOperations: BILLING_OPERATIONS });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();

    const { name, prices, effectiveFrom } = body as {
      name?: string;
      prices?: Record<string, number>;
      effectiveFrom?: string;
    };

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!prices || typeof prices !== "object") {
      return NextResponse.json({ error: "prices object is required" }, { status: 400 });
    }

    for (const [key, val] of Object.entries(prices)) {
      if (!isBillingOperation(key)) {
        return NextResponse.json(
          { error: `Unknown billing operation: ${key}` },
          { status: 400 }
        );
      }
      if (typeof val !== "number" || val < 0) {
        return NextResponse.json(
          { error: `Invalid price for ${key}: must be a non-negative number` },
          { status: 400 }
        );
      }
    }

    const config = await db.$transaction(async (tx) => {
      await tx.pricingConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      return tx.pricingConfig.create({
        data: {
          name,
          prices: JSON.stringify(prices),
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
          isActive: true,
          createdBy: admin.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      config: { ...config, prices: JSON.parse(config.prices) },
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    const { id, prices, name } = body as {
      id?: string;
      prices?: Record<string, number>;
      name?: string;
    };

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await db.pricingConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const data: { prices?: string; name?: string } = {};

    if (prices && typeof prices === "object") {
      for (const [key, val] of Object.entries(prices)) {
        if (!isBillingOperation(key)) {
          return NextResponse.json(
            { error: `Unknown billing operation: ${key}` },
            { status: 400 }
          );
        }
        if (typeof val !== "number" || val < 0) {
          return NextResponse.json(
            { error: `Invalid price for ${key}: must be a non-negative number` },
            { status: 400 }
          );
        }
      }
      data.prices = JSON.stringify(prices);
    }

    if (name && typeof name === "string") {
      data.name = name;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await db.pricingConfig.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      config: { ...updated, prices: JSON.parse(updated.prices) },
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

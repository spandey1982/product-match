import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { deserializeProduct, serializeArray } from "@/lib/serialize";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const product = await db.product.findFirst({
      where: { id, userId: session.id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({
      product: deserializeProduct(product as unknown as Record<string, unknown>),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const existing = await db.product.findFirst({
      where: { id, userId: session.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Serialize array fields if present
    const updateData: Prisma.ProductUpdateInput = {
      ...body,
      ...(Array.isArray(body.colors)    && { colors:    serializeArray(body.colors) }),
      ...(Array.isArray(body.occasion)  && { occasion:  serializeArray(body.occasion) }),
      ...(Array.isArray(body.styleTags) && { styleTags: serializeArray(body.styleTags) }),
      ...(Array.isArray(body.season)    && { season:    serializeArray(body.season) }),
    };

    const product = await db.product.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      product: deserializeProduct(product as unknown as Record<string, unknown>),
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await db.product.findFirst({
      where: { id, userId: session.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await db.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

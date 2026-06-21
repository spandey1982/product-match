import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { serializeArray, deserializeProduct } from "@/lib/serialize";
import { generateRecommendations } from "@/lib/matching-engine/scorer";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");
    const color = searchParams.get("color");
    const occasion = searchParams.get("occasion");
    const gender = searchParams.get("gender");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");

    const where: Prisma.ProductWhereInput = {
      userId: session.id,
      isActive: true,
    };

    if (category) where.category = category;
    if (color) where.color = { contains: color };
    if (gender) where.gender = gender;
    if (occasion) where.occasion = { contains: occasion };

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      products: products.map((p) =>
        deserializeProduct(p as unknown as Record<string, unknown>)
      ),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const {
      title,
      description,
      category,
      subcategory,
      color,
      colors,
      occasion,
      styleTags,
      material,
      pattern,
      gender,
      season,
      price,
      imageUrl,
      backImageUrl,
      sku,
    } = body;

    if (!title || !category || !color || !price) {
      return NextResponse.json(
        { error: "title, category, color, and price are required" },
        { status: 400 }
      );
    }

    const product = await db.product.create({
      data: {
        title,
        description,
        category,
        subcategory,
        color,
        colors: serializeArray(colors || [color]),
        occasion: serializeArray(occasion || []),
        styleTags: serializeArray(styleTags || []),
        material,
        pattern: pattern || null,
        gender: gender || "WOMEN",
        season: serializeArray(season || []),
        price: parseFloat(price),
        imageUrl,
        backImageUrl: backImageUrl || null,
        sku: sku || undefined,
        userId: session.id,
      },
    });

    // Fire-and-forget: regenerate recommendations for every existing product
    // so the new product immediately appears in their match lists.
    // Run after responding — does not block the 201 response.
    const allProducts = await db.product.findMany({
      where: { userId: session.id, isActive: true, id: { not: product.id } },
      select: { id: true },
    });
    Promise.allSettled(
      allProducts.map((p) => generateRecommendations(p.id, session.id))
    ).catch(console.error);

    return NextResponse.json(
      { product: deserializeProduct(product as unknown as Record<string, unknown>) },
      { status: 201 }
    );
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

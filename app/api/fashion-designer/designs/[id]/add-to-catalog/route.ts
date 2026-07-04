import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeArray } from "@/lib/serialize";
import { generateRecommendations } from "@/lib/matching-engine/scorer";
import type { FabricAnalysis, DesignUnderstanding, GenerationPlan } from "@/lib/fashion-designer/types";

// Map garment type → catalog category
const CATEGORY_MAP: Record<string, string> = {
  Blouse: "Blouse",
  Kurti: "Kurti",
  Saree: "Saree",
  Lehenga: "Lehenga",
  Salwar: "Salwar Kameez",
  Anarkali: "Anarkali",
  Sharara: "Sharara",
  Palazzo: "Palazzo",
  Shirt: "Shirt",
  Trouser: "Trouser",
  "Men Suit": "Suit",
  Dupatta: "Dupatta",
  Other: "Other",
};

const GENDER_MAP: Record<string, string> = {
  Shirt: "MEN",
  Trouser: "MEN",
  "Men Suit": "MEN",
};

// POST /api/fashion-designer/designs/[id]/add-to-catalog
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const design = await db.fashionDesign.findFirst({
      where: { id, userId: session.id },
    });

    if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });
    if (design.stage !== "completed" || !design.flatFrontUrl) {
      return NextResponse.json({ error: "Design is not completed" }, { status: 400 });
    }
    if (design.catalogProductId) {
      return NextResponse.json({ productId: design.catalogProductId });
    }

    const fabric = design.fabricAnalysis
      ? (JSON.parse(design.fabricAnalysis) as FabricAnalysis)
      : null;
    const understanding = design.designUnderstanding
      ? (JSON.parse(design.designUnderstanding) as DesignUnderstanding)
      : null;
    const plan = design.generationPlan
      ? (JSON.parse(design.generationPlan) as GenerationPlan)
      : null;

    // Build product fields from design analysis
    const primaryColor = fabric?.color?.split(",")[0]?.trim() ?? "Multicolor";
    const material = fabric?.fabricType ?? undefined;
    const pattern = fabric?.pattern ?? undefined;
    const category = CATEGORY_MAP[design.garmentType] ?? design.garmentType;
    const gender = GENDER_MAP[design.garmentType] ?? "WOMEN";

    const occasionList: string[] = [];
    const styleTags = [
      understanding?.neckStyle,
      understanding?.sleeveStyle,
      understanding?.embroidery,
      fabric?.pattern,
    ].filter((v): v is string => !!v && v !== "Unknown" && v !== "None");

    // Compose a readable description from the plan + fabric analysis
    const descParts: string[] = [];
    if (plan?.garmentDescription) descParts.push(plan.garmentDescription);
    if (fabric) {
      const details = [
        fabric.fabricType && `${fabric.fabricType} fabric`,
        fabric.weave && fabric.weave !== "Unknown" && fabric.weave,
        fabric.pattern && fabric.pattern !== "Unknown" && `${fabric.pattern} pattern`,
        fabric.finish && fabric.finish !== "Unknown" && `${fabric.finish} finish`,
      ].filter(Boolean);
      if (details.length) descParts.push(`Made from ${details.join(", ")}.`);
    }
    if (plan?.accessoryPlacement && plan.accessoryPlacement !== "None") {
      descParts.push(plan.accessoryPlacement);
    }
    const description = descParts.join(" ") || `AI-designed ${design.garmentType}.`;

    const product = await db.product.create({
      data: {
        userId: session.id,
        title: design.title,
        description,
        category,
        color: primaryColor,
        colors: serializeArray([primaryColor]),
        occasion: serializeArray(occasionList),
        styleTags: serializeArray(styleTags),
        material,
        pattern,
        gender,
        season: serializeArray([]),
        price: 0,
        imageUrl: design.flatFrontUrl,
        backImageUrl: design.flatBackUrl ?? undefined,
      },
    });

    // Create ProductImage records for all generated views so they appear in
    // the catalog carousel (generatedImages) in order: front first, then back.
    const imageRecords: { productId: string; url: string; view: string; objective: string; isPrimary: boolean }[] = [];
    imageRecords.push({ productId: product.id, url: design.flatFrontUrl, view: "front", objective: "catalogue", isPrimary: true });
    if (design.flatBackUrl) {
      imageRecords.push({ productId: product.id, url: design.flatBackUrl, view: "back", objective: "catalogue", isPrimary: false });
    }
    await db.productImage.createMany({ data: imageRecords });

    // Persist the link so the UI can show "View in Catalog" after page refresh
    await db.fashionDesign.update({
      where: { id },
      data: { catalogProductId: product.id },
    });

    // Generate recommendations in the background
    generateRecommendations(product.id, session.id).catch(() => {});

    return NextResponse.json({ productId: product.id });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[fashion-designer] add-to-catalog error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";

/**
 * Lead capture — "Request a quote / contact retailer" (brief §17: consumer-
 * first experience + retailer catalogue/lead backend, no full marketplace
 * in V1). Resolves to whichever HmRetailer exists; as of 2026-09-08 that's
 * exactly one deliberately-labeled placeholder (scripts/seed-retailers.ts)
 * since this repo has zero real retailer partnerships yet — the response
 * always echoes back the retailer's name/isVerified so the UI can be
 * honest about that, never silently implying a real business received it.
 */
export async function POST(req: NextRequest) {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId, materialCategory, contactName, contactPhone, contactEmail, message, areaSqft } = await req.json();

  if (typeof contactName !== "string" || !contactName.trim()) {
    return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  }
  if (typeof contactPhone !== "string" || !contactPhone.trim()) {
    return NextResponse.json({ error: "A contact phone number is required" }, { status: 400 });
  }
  if (!productId && !materialCategory) {
    return NextResponse.json({ error: "A product or material category is required" }, { status: 400 });
  }
  // HmLead.estimatedAreaSqm is genuinely square metres — the UI collects
  // sqft (the unit every cost figure in this domain is quoted in, and the
  // common Indian real-estate unit) and this is the one place that
  // converts, so the stored field matches its own name honestly.
  const SQFT_TO_SQM = 0.092903;
  const estimatedAreaSqm =
    typeof areaSqft === "number" && Number.isFinite(areaSqft) && areaSqft > 0 ? areaSqft * SQFT_TO_SQM : null;

  if (productId) {
    const product = await db.hmProduct.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const retailer = await db.hmRetailer.findFirst({ orderBy: { createdAt: "asc" } });
  if (!retailer) {
    return NextResponse.json(
      { error: "No retailer is set up yet to receive requests. Please try again later." },
      { status: 503 }
    );
  }

  const project = await db.hmProject.findFirst({ where: { hmUserId: session.id } });

  const lead = await db.hmLead.create({
    data: {
      hmUserId: session.id,
      projectId: project?.id ?? null,
      retailerId: retailer.id,
      productId: productId ?? null,
      materialCategory: materialCategory ?? null,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: typeof contactEmail === "string" && contactEmail.trim() ? contactEmail.trim() : null,
      message: typeof message === "string" && message.trim() ? message.trim() : null,
      estimatedAreaSqm,
    },
  });

  return NextResponse.json({
    lead,
    retailer: { name: retailer.name, isVerified: retailer.isVerified },
  });
}

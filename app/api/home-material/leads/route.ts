import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateHmUserSession } from "@/lib/home-material/auth";

/**
 * Lead capture — "Request a quote" or "Request a sample" (brief §17:
 * consumer-first experience + retailer catalogue/lead backend, no full
 * marketplace in V1; §41's Validation-layer sample loop, 2026-09-10).
 * Resolves to whichever HmRetailer exists; as of 2026-09-08 that's
 * exactly one deliberately-labeled placeholder (scripts/seed-retailers.ts)
 * since this repo has zero real retailer partnerships yet — the response
 * always echoes back the retailer's name/isVerified so the UI can be
 * honest about that, never silently implying a real business received it.
 */
export async function POST(req: NextRequest) {
  const session = await getOrCreateHmUserSession();

  const { productId, materialCategory, contactName, contactPhone, contactEmail, message, areaSqft, leadType, shippingAddress } =
    await req.json();

  if (typeof contactName !== "string" || !contactName.trim()) {
    return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  }
  if (typeof contactPhone !== "string" || !contactPhone.trim()) {
    return NextResponse.json({ error: "A contact phone number is required" }, { status: 400 });
  }
  if (!productId && !materialCategory) {
    return NextResponse.json({ error: "A product or material category is required" }, { status: 400 });
  }
  // A physical sample requires a real SKU to actually ship (brief §41) —
  // never meaningful for a material-category-only recommendation.
  const resolvedLeadType = leadType === "sample" ? "sample" : "quote";
  if (resolvedLeadType === "sample" && !productId) {
    return NextResponse.json({ error: "A sample request needs a specific product, not just a material category" }, { status: 400 });
  }
  if (resolvedLeadType === "sample" && (typeof shippingAddress !== "string" || !shippingAddress.trim())) {
    return NextResponse.json({ error: "A shipping address is required to send a sample" }, { status: 400 });
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
      leadType: resolvedLeadType,
      shippingAddress: resolvedLeadType === "sample" && typeof shippingAddress === "string" ? shippingAddress.trim() : null,
    },
  });

  return NextResponse.json({
    lead,
    retailer: { name: retailer.name, isVerified: retailer.isVerified },
  });
}

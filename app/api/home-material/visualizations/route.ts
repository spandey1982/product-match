import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { runQuickPreviewVisualization } from "@/lib/home-material/visualization";
import { generateVisualizationOverview, pickAlternativeProductIds } from "@/lib/home-material/overview";
import { serializeArray } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { surfaceId, productId } = await req.json();
  if (typeof surfaceId !== "string" || typeof productId !== "string") {
    return NextResponse.json({ error: "surfaceId and productId are required" }, { status: 400 });
  }

  const surface = await db.hmSurface.findUnique({
    where: { id: surfaceId },
    include: { room: { include: { project: true } } },
  });
  if (!surface || surface.room.project.hmUserId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const product = await db.hmProduct.findUnique({
    where: { id: productId },
    include: { material: { select: { category: true } } },
  });
  if (!product) {
    return NextResponse.json({ error: "Swatch not found" }, { status: 404 });
  }

  const geometry = surface.geometryData ? JSON.parse(surface.geometryData) : null;
  const points = geometry?.points;
  if (!Array.isArray(points) || points.length < 3) {
    return NextResponse.json({ error: "This wall has no selected region yet" }, { status: 400 });
  }
  // Optional perspective quad (sub-problem B) — present only when the
  // wall was confidently detected at an angle; null for the common
  // straight-on case, same as always.
  const corners = Array.isArray(geometry?.corners) && geometry.corners.length === 4 ? geometry.corners : null;

  // A product with a real uploaded reference photo gets product-accurate
  // treatment (the actual material, not an AI-imagined approximation of a
  // text description) — see lib/home-material/visualization.ts's
  // QuickPreviewResult.mode doc comment and docs/home-material/README.md's
  // Product-Accurate mode section.
  const initialMode = product.textureAssetUrl ? "product_accurate" : "quick_preview";

  const visualization = await db.hmVisualization.create({
    data: {
      surfaceId,
      productId,
      mode: initialMode,
      inputImageUrl: surface.room.imageUrl,
      status: "processing",
      provider: "gemini",
    },
  });

  const result = await runQuickPreviewVisualization({
    roomImageUrl: surface.room.imageUrl,
    points,
    swatch: {
      id: product.id,
      name: product.name,
      colorName: product.colorName,
      colorHex: product.colorHex,
      finish: product.finish,
      patternName: product.patternName,
    },
    // Custom-uploaded swatches carry their real photo here (curated demo
    // swatches don't have one) — real pixels beat a text description.
    referenceImageUrl: product.textureAssetUrl,
    corners,
    hmUserId: session.id,
    visualizationId: visualization.id,
  });

  if ("error" in result) {
    const updated = await db.hmVisualization.update({
      where: { id: visualization.id },
      data: { status: "failed", errorMessage: result.error },
    });
    return NextResponse.json({ visualization: updated, error: result.error }, { status: 502 });
  }

  // Deterministic alternatives — chosen from the catalogue, never
  // AI-invented (Constitution Principle 7). Computed before the AI
  // overview call so it's available even if that call fails.
  const otherProducts = await db.hmProduct.findMany({
    where: {
      id: { not: product.id },
      OR: [{ uploadedByHmUserId: null }, { uploadedByHmUserId: session.id }],
    },
    select: { id: true, material: { select: { category: true } } },
  });
  const alternativeProductIds = pickAlternativeProductIds(
    product.id,
    product.material?.category ?? null,
    otherProducts.map((p) => ({ id: p.id, category: p.material?.category ?? null }))
  );

  // Mandatory "honest overview" pass over the FINAL composited image (see
  // docs/home-material/README.md) — a soft feature: its failure never
  // hides an otherwise-successful preview, so this is awaited but never
  // allowed to fail the request.
  const overview = await generateVisualizationOverview({
    outputImageUrl: result.url,
    materialName: product.name,
    hmUserId: session.id,
    visualizationId: visualization.id,
  });

  const updated = await db.hmVisualization.update({
    where: { id: visualization.id },
    data: {
      status: "completed",
      outputImageUrl: result.url,
      model: result.model,
      mode: result.mode,
      provider: result.perspectiveCorrected ? "deterministic" : "gemini",
      perspectiveCorrected: result.perspectiveCorrected,
      overviewStatus: "error" in overview ? "failed" : "completed",
      overviewOpening: "error" in overview ? null : overview.opening,
      overviewHighlights: "error" in overview ? "[]" : serializeArray(overview.highlights),
      overviewConsiderations: "error" in overview ? "[]" : serializeArray(overview.considerations),
      overviewClosing: "error" in overview ? null : overview.closing,
      overviewAlternativeProductIds: serializeArray(alternativeProductIds),
    },
  });

  return NextResponse.json({ visualization: updated });
}

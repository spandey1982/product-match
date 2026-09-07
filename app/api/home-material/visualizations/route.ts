import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { runQuickPreviewVisualization } from "@/lib/home-material/visualization";

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

  const product = await db.hmProduct.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Swatch not found" }, { status: 404 });
  }

  const geometry = surface.geometryData ? JSON.parse(surface.geometryData) : null;
  const points = geometry?.points;
  if (!Array.isArray(points) || points.length < 3) {
    return NextResponse.json({ error: "This wall has no selected region yet" }, { status: 400 });
  }

  const visualization = await db.hmVisualization.create({
    data: {
      surfaceId,
      productId,
      mode: "quick_preview",
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

  const updated = await db.hmVisualization.update({
    where: { id: visualization.id },
    data: {
      status: "completed",
      outputImageUrl: result.url,
      model: result.model,
    },
  });

  return NextResponse.json({ visualization: updated });
}

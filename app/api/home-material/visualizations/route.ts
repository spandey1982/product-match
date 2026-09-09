import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHmUserSession } from "@/lib/home-material/auth";
import { runQuickPreviewVisualization } from "@/lib/home-material/visualization";
import { generateVisualizationOverview, pickAlternativeProductIds } from "@/lib/home-material/overview";
import { estimateWallDimensions } from "@/lib/home-material/scale-estimation";
import { serializeArray } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  const session = await getHmUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { surfaceId, productId, skipDimensionCheck } = await req.json();
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

  // Repeat-pattern sheet goods need the WALL's real size to render at
  // true physical scale (2026-09-09) — a customizable design doesn't
  // (it just scales to fit, same as always). Per the user's explicit
  // instruction: try a reference-object AI estimate first when the wall's
  // real size isn't already known; if that isn't possible either, block
  // this one preview attempt with a message rather than silently
  // rendering at a made-up scale — once resolved (either way), the wall's
  // widthMeters/heightMeters is set and nothing blocks again.
  let wallWidthM = surface.widthMeters;
  let wallHeightM = surface.heightMeters;

  if (product.patternType === "repeat_sheet" && (wallWidthM == null || wallHeightM == null) && skipDimensionCheck !== true) {
    const estimate = await estimateWallDimensions(surface.room.imageUrl, points, session.id);
    if ("widthM" in estimate) {
      wallWidthM = estimate.widthM;
      wallHeightM = estimate.heightM;
      await db.hmSurface.update({
        where: { id: surfaceId },
        data: { widthMeters: wallWidthM, heightMeters: wallHeightM, areaSqm: wallWidthM * wallHeightM, dimensionsEstimated: true },
      });
    } else {
      const reason = "unavailable" in estimate ? estimate.reason : estimate.error;
      return NextResponse.json(
        {
          needsDimensions: true,
          error: `A rough wall size will give a much more accurate preview and sheet count for this repeating pattern — we couldn't estimate one automatically (${reason}). Enter the wall's real width/height, or continue anyway for an illustrative-scale preview.`,
        },
        { status: 422 }
      );
    }
  }

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
    patternType: product.patternType,
    sheetWidthM: product.sheetWidthM,
    sheetHeightM: product.sheetHeightM,
    wallWidthM,
    wallHeightM,
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
      provider: result.perspectiveCorrected || result.trueScaleRendered ? "deterministic" : "gemini",
      perspectiveCorrected: result.perspectiveCorrected,
      trueScaleRendered: result.trueScaleRendered,
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

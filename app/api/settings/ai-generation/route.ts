import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import {
  getAiGenSettings,
  serializeAiGenSettings,
  isBrandingPosition,
  isCatalogueProvider,
  type AiGenSettings,
} from "@/lib/model-gen/settings";
import { isAiGenObjectivesEnabled, isScenicCollectionEnabled } from "@/lib/model-gen/engine";
import { listObjectives, isGenerationObjective } from "@/lib/model-gen/objectives";
import { MODEL_TYPES, isModelType } from "@/lib/model-gen/reference-models";
import { listBackdropOptions, isBackdropSelection } from "@/lib/model-gen/backdrops";
import { listSceneOptions, BRAND_PACKS } from "@/lib/model-gen/scenes/library";
import { isScenicSelection } from "@/lib/model-gen/scenes/selection";
import { isVertexTryOnEnabled, getVertexConfig } from "@/lib/tryon-vertex";

/** Resolve the store logo's delivery URL from its public_id, if uploaded. */
async function logoUrl(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { logoPublicId: true },
  });
  if (!user?.logoPublicId) return null;
  return cloudinary.url(user.logoPublicId, { secure: true });
}

/** Static option metadata the UI needs to render the (provider-free) chooser. */
function options() {
  return {
    enabled: isAiGenObjectivesEnabled(),
    objectives: listObjectives().map((o) => ({
      id: o.id,
      label: o.label,
      description: o.description,
    })),
    modelTypes: MODEL_TYPES,
    // Studio backdrop presets for the chooser (CSS-rendered previews).
    backdrops: listBackdropOptions(),
    // Whether "Sharp Fit" (Vertex) is usable; "Natural Drape"/"Automatic" always are.
    vertexAvailable: isVertexTryOnEnabled() && getVertexConfig() !== null,
    // Scenic Collection: scenes + their brand-pack grouping (CSS-rendered previews).
    scenes: listSceneOptions(),
    brandPacks: BRAND_PACKS,
    scenicEnabled: isScenicCollectionEnabled(),
  };
}

// GET — current AI-generation settings + the option lists for the UI.
export async function GET() {
  try {
    const session = await requireAuth();
    const [settings, logo] = await Promise.all([
      getAiGenSettings(session.id),
      logoUrl(session.id),
    ]);
    return NextResponse.json({ settings, logoUrl: logo, ...options() });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update this retailer's default model type and/or objective.
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));

    const rawModelType = (body as { defaultModelType?: unknown }).defaultModelType;
    const rawObjective = (body as { defaultObjective?: unknown }).defaultObjective;
    const rawBrandingEnabled = (body as { brandingEnabled?: unknown }).brandingEnabled;
    const rawBrandingPosition = (body as { brandingPosition?: unknown }).brandingPosition;
    const rawCatalogueProvider = (body as { catalogueProvider?: unknown }).catalogueProvider;
    const rawBackdrop = (body as { backdrop?: unknown }).backdrop;
    const rawScenic = (body as { scenic?: unknown }).scenic;

    if (rawModelType !== undefined && !isModelType(rawModelType)) {
      return NextResponse.json(
        { error: "Invalid model type." },
        { status: 400 }
      );
    }
    if (rawObjective !== undefined && !isGenerationObjective(rawObjective)) {
      return NextResponse.json(
        { error: "Invalid generation objective." },
        { status: 400 }
      );
    }
    if (rawBrandingEnabled !== undefined && typeof rawBrandingEnabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid branding toggle." },
        { status: 400 }
      );
    }
    if (rawBrandingPosition !== undefined && !isBrandingPosition(rawBrandingPosition)) {
      return NextResponse.json(
        { error: "Invalid branding position." },
        { status: 400 }
      );
    }
    if (rawCatalogueProvider !== undefined && !isCatalogueProvider(rawCatalogueProvider)) {
      return NextResponse.json(
        { error: "Invalid catalogue style." },
        { status: 400 }
      );
    }
    if (rawBackdrop !== undefined && !isBackdropSelection(rawBackdrop)) {
      return NextResponse.json(
        { error: "Invalid backdrop." },
        { status: 400 }
      );
    }
    if (rawScenic !== undefined && !isScenicSelection(rawScenic)) {
      return NextResponse.json(
        { error: "Invalid scenic selection." },
        { status: 400 }
      );
    }

    // Merge onto the current (defaulted) settings so a partial update is safe.
    const current = await getAiGenSettings(session.id);
    const next: AiGenSettings = {
      defaultModelType: isModelType(rawModelType) ? rawModelType : current.defaultModelType,
      defaultObjective: isGenerationObjective(rawObjective) ? rawObjective : current.defaultObjective,
      brandingEnabled: typeof rawBrandingEnabled === "boolean" ? rawBrandingEnabled : current.brandingEnabled,
      brandingPosition: isBrandingPosition(rawBrandingPosition) ? rawBrandingPosition : current.brandingPosition,
      catalogueProvider: isCatalogueProvider(rawCatalogueProvider) ? rawCatalogueProvider : current.catalogueProvider,
      backdrop: isBackdropSelection(rawBackdrop) ? rawBackdrop : current.backdrop,
      scenic: isScenicSelection(rawScenic) ? rawScenic : current.scenic,
    };

    await db.user.update({
      where: { id: session.id },
      data: { aiGenSettings: serializeAiGenSettings(next) },
    });

    return NextResponse.json({ settings: next, logoUrl: await logoUrl(session.id), ...options() });
  } catch (err) {
    if ((err as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

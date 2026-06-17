import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import {
  getAiGenSettings,
  serializeAiGenSettings,
  isBrandingPosition,
  type AiGenSettings,
} from "@/lib/model-gen/settings";
import { isAiGenObjectivesEnabled } from "@/lib/model-gen/engine";
import { listObjectives, isGenerationObjective } from "@/lib/model-gen/objectives";
import { MODEL_TYPES, isModelType } from "@/lib/model-gen/reference-models";

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

    // Merge onto the current (defaulted) settings so a partial update is safe.
    const current = await getAiGenSettings(session.id);
    const next: AiGenSettings = {
      defaultModelType: isModelType(rawModelType) ? rawModelType : current.defaultModelType,
      defaultObjective: isGenerationObjective(rawObjective) ? rawObjective : current.defaultObjective,
      brandingEnabled: typeof rawBrandingEnabled === "boolean" ? rawBrandingEnabled : current.brandingEnabled,
      brandingPosition: isBrandingPosition(rawBrandingPosition) ? rawBrandingPosition : current.brandingPosition,
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

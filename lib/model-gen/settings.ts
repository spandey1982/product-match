/**
 * Typed accessor for the retailer's AI Generation settings.
 *
 * Stored as a single nullable JSON string in User.aiGenSettings (one column →
 * no migration as the surface grows; see docs/IMAGE_AI_ROADMAP.md §8). Never
 * parse that column inline — always go through here so validation and defaults
 * are applied consistently.
 */
import { db } from "@/lib/db";
import {
  DEFAULT_MODEL_TYPE,
  isModelType,
  type ModelType,
} from "./reference-models";
import {
  DEFAULT_OBJECTIVE,
  isGenerationObjective,
  type GenerationObjective,
} from "./objectives";

export interface AiGenSettings {
  defaultModelType: ModelType;
  defaultObjective: GenerationObjective;
}

export const DEFAULT_AI_GEN_SETTINGS: AiGenSettings = {
  defaultModelType: DEFAULT_MODEL_TYPE,
  defaultObjective: DEFAULT_OBJECTIVE,
};

/** Parse raw aiGenSettings JSON into a fully-populated, validated object. */
export function parseAiGenSettings(raw: string | null | undefined): AiGenSettings {
  if (!raw) return { ...DEFAULT_AI_GEN_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      defaultModelType: isModelType(parsed.defaultModelType)
        ? parsed.defaultModelType
        : DEFAULT_MODEL_TYPE,
      defaultObjective: isGenerationObjective(parsed.defaultObjective)
        ? parsed.defaultObjective
        : DEFAULT_OBJECTIVE,
    };
  } catch {
    return { ...DEFAULT_AI_GEN_SETTINGS };
  }
}

export function serializeAiGenSettings(settings: AiGenSettings): string {
  return JSON.stringify(settings);
}

/** Load a retailer's AI-gen settings, falling back to defaults on any issue. */
export async function getAiGenSettings(userId: string): Promise<AiGenSettings> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { aiGenSettings: true },
    });
    return parseAiGenSettings(user?.aiGenSettings);
  } catch {
    return { ...DEFAULT_AI_GEN_SETTINGS };
  }
}

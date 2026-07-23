/** Shared types for the AI Fashion Designer pipeline. */

export type DesignStage =
  | "uploading"
  | "analyzing_fabric"
  | "analyzing_design"
  | "analyzing_accessories"
  | "planning"
  | "constructing"
  | "generating_flat_images"
  | "completed"
  | "failed";

export interface FabricAnalysis {
  fabricType: string;
  color: string;
  pattern: string;
  texture: string;
  patternRepeat: string;
  finish: string;
  transparency: string;
  shine: string;
  weave: string;
  orientation: string;
}

export interface DesignUnderstanding {
  garmentCategory: string;
  neckStyle: string;
  sleeveStyle: string;
  backStyle: string;
  fit: string;
  length: string;
  closure: string;
  pleats: string;
  panels: string;
  borders: string;
  embroidery: string;
  stitchLines: string;
  decorativeElements: string;
}

export interface AccessoryItem {
  type: string;
  color: string;
  dimensions: string;
  placementSuggestion: string;
}

export interface AccessoryAnalysis {
  items: AccessoryItem[];
}

export interface GenerationPlan {
  garmentDescription: string;
  flatFrontPrompt: string;
  flatBackPrompt: string;
  panelNotes: string;
  stitchingNotes: string;
  accessoryPlacement: string;
  printContinuityNotes: string;
}

export interface DesignAsset {
  id: string;
  designId: string;
  assetType: string;
  url: string;
  fileName: string;
  mimeType: string;
}

export interface FashionDesignRecord {
  id: string;
  userId: string;
  title: string;
  garmentType: string;
  templateId: string | null;
  structuredOptions: string | null;
  designNotes: string | null;
  stage: DesignStage;
  fabricAnalysis: FabricAnalysis | null;
  designUnderstanding: DesignUnderstanding | null;
  accessoryAnalysis: AccessoryAnalysis | null;
  generationPlan: GenerationPlan | null;
  flatFrontUrl: string | null;
  flatBackUrl: string | null;
  qualityScore: number | null;
  failureReason: string | null;
  failedAtStage: string | null;
  createdAt: string;
  updatedAt: string;
  assets: DesignAsset[];
}

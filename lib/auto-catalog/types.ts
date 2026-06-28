/** Shared types for the Autonomous AI Catalog pipeline. */

export type PipelineStage =
  | "uploaded"
  | "classifying"
  | "unknown"
  | "cataloging"
  | "generating_images"
  | "qc_running"
  | "retrying"
  | "manual_qc"
  | "ready"
  | "published"
  | "failed";

export interface ClassificationResult {
  category: string;
  confidence: number; // 0–1
  groupId: string;    // groups images of the same product together
}

export interface CatalogField {
  value: string | number | string[];
  confidence: number; // 0–1
}

export interface CatalogResult {
  title: CatalogField;
  description: CatalogField;
  category: CatalogField;
  subcategory: CatalogField;
  color: CatalogField;
  pattern: CatalogField;
  material: CatalogField;
  gender: CatalogField;
  occasion: CatalogField;
  styleTags: CatalogField;
  season: CatalogField;
  price: CatalogField;
}

export type QcStatus = "pass" | "warning" | "failed";

export interface QcCheck {
  status: QcStatus;
  confidence: number;
  message: string;
}

export interface QcResult {
  overall: QcStatus;
  score: number; // 0–100
  checks: {
    // Catalog checks
    missingFields: QcCheck;
    categoryConfidence: QcCheck;
    colorConfidence: QcCheck;
    materialConfidence: QcCheck;
    // Image checks
    imageQuality: QcCheck;
    hasGeneratedImage: QcCheck;
  };
  failedFields: string[];
  failedImages: string[];
}

/** The CLASSIFICATION_THRESHOLD below which a product goes to Unknown Bucket. */
export const CLASSIFICATION_THRESHOLD = 0.6;

/** The QC score below which a product fails QC. */
export const QC_PASS_THRESHOLD = 60;

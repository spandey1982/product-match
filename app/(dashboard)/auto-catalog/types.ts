export interface AutoCatalogBatch {
  id: string;
  userId: string;
  status: string;
  totalCount: number;
  uploadedCount: number;
  classifiedCount: number;
  unknownCount: number;
  catalogedCount: number;
  imagedCount: number;
  qcPassedCount: number;
  retryingCount: number;
  manualQcCount: number;
  publishedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutoCatalogItem {
  id: string;
  batchId: string;
  userId: string;
  imageUrl: string;
  fileName: string;
  stage: string;
  classificationResult: string | null;
  catalogResult: string | null;
  qcResult: string | null;
  retryCount: number;
  failureReason: string | null;
  productId: string | null;
  createdAt: string;
  updatedAt: string;
}

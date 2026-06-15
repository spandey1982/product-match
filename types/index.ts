export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  storeName?: string | null;
  tryOnProvider?: "gemini" | "vertex" | "auto";
  /** AI Generation preferences as a JSON string. See lib/model-gen/settings.ts. */
  aiGenSettings?: string | null;
};

/** An AI-generated catalogue/model image for a product (multi-view gallery). */
export type ProductImage = {
  id: string;
  productId: string;
  url: string;
  view: string;       // "front" | "back" | "pallu" | "border" | "blouse" | "fabric" | ...
  objective: string;  // "quick_listing" | "catalogue"
  isPrimary: boolean;
  createdAt: string;
};

export type Product = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  color: string;
  colors: string[];
  occasion: string[];
  styleTags: string[];
  material?: string | null;
  gender: string;
  season: string[];
  price: number;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  modelImageUrl?: string | null;
  inStock: boolean;
  isActive: boolean;
  sku?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type Recommendation = {
  productId: string;
  matchScore: number;
  categoryScore: number;
  colorScore: number;
  occasionScore: number;
  styleScore: number;
  confidence: number;
  explanation: string;
  explanationTags: string[];
  product?: Product;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

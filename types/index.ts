export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  storeName?: string | null;
  tryOnProvider?: "gemini" | "vertex" | "auto";
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

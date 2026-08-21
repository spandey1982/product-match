export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  storeName?: string | null;
  tryOnProvider?: "gemini" | "vertex" | "auto";
  /** AI Generation preferences as a JSON string. See lib/model-gen/settings.ts. */
  aiGenSettings?: string | null;
  /** Cloudinary public_id of the store logo overlaid on generated images. */
  logoPublicId?: string | null;
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
  pattern?: string | null;
  detailNotes?: string | null;
  gender: string;
  season: string[];
  price: number;
  /** Original/MRP price — shown struck-through next to `price` when set and greater than it. */
  mrpPrice?: number | null;
  /** 1-100, only meaningful alongside mrpPrice. See ProductDetailView's edit form for the auto-calc. */
  discountPercent?: number | null;
  /** Free-text size (e.g. "M", "UK 8") — optional, no retailer entry UI yet. Shown on /shop's home-trial flow only when set. */
  size?: string | null;
  isForRent: boolean;
  rentalPricePerDay?: number | null;
  rentalDeposit?: number | null;
  imageUrl?: string | null;
  backImageUrl?: string | null;
  /** JSON-string array of { slot, label, url } — parse with lib/product/part-slots.ts's parsePartImages, never by hand. */
  partImages?: string | null;
  thumbnailUrl?: string | null;
  modelImageUrl?: string | null;
  generatedImages?: ProductImage[];
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

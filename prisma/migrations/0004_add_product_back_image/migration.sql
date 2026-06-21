-- Optional back-of-product image for precise back-profile generation (Phase H).
-- Nullable → existing rows and the current flow are unaffected.
ALTER TABLE "products" ADD COLUMN "backImageUrl" TEXT;

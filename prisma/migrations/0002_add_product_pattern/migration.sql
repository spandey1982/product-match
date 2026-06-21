-- Add visual pattern/print metadata to products (shared metadata service).
-- Nullable → existing rows unaffected; applied on top of 0001_init.
ALTER TABLE "products" ADD COLUMN "pattern" TEXT;

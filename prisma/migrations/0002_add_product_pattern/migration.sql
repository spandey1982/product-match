-- AlterTable
-- Additive, backward-compatible: nullable column, existing rows unaffected.
ALTER TABLE "products" ADD COLUMN "pattern" TEXT;

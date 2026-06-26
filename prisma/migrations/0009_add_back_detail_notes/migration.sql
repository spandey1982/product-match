-- Prompt enrichment: back-image detail notes, fed only into the BACK-view prompt
-- (catalogue generates a back view; quick-listing is front-only). Additive, nullable.
ALTER TABLE "products" ADD COLUMN "backDetailNotes" TEXT;

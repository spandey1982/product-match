-- Optional category-specific detail close-ups (pallu/border/blouse/skirt/…) as a
-- JSON array of { slot, label, url }. Extraction-only (enriches the prompt; never
-- sent to the image generator). Additive, nullable.
ALTER TABLE "products" ADD COLUMN "partImages" TEXT;

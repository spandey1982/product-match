-- Prompt enrichment (v1): concise, category-aware generation hints describing the
-- visually critical product specifics (weave/technique, motifs, border,
-- embellishment, texture) that the model must preserve. Lazily extracted once and
-- cached, then fed into the generation prompt. Additive + nullable.
ALTER TABLE "products" ADD COLUMN "detailNotes" TEXT;

-- Image facts on generation records (HQ step 2): model name + master image
-- dimensions and file size, for quality/cost reporting. All nullable.
ALTER TABLE "generation_records" ADD COLUMN "modelName" TEXT;
ALTER TABLE "generation_records" ADD COLUMN "width" INTEGER;
ALTER TABLE "generation_records" ADD COLUMN "height" INTEGER;
ALTER TABLE "generation_records" ADD COLUMN "fileSizeBytes" INTEGER;

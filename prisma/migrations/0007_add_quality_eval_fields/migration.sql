-- Extended quality-evaluation fields on generation records (HQ step 5).
ALTER TABLE "generation_records" ADD COLUMN "aiTextureQuality" REAL;
ALTER TABLE "generation_records" ADD COLUMN "aiProductVisibility" REAL;
ALTER TABLE "generation_records" ADD COLUMN "aiIssues" TEXT;

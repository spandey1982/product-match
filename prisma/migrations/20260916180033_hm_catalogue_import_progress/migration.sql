-- AlterTable
ALTER TABLE "hm_catalogue_imports" ADD COLUMN     "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceFileUrl" TEXT NOT NULL;

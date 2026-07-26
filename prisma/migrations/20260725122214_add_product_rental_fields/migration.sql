-- AlterTable
ALTER TABLE "fashion_designs" ADD COLUMN     "failedAtStage" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isForRent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rentalDeposit" DOUBLE PRECISION,
ADD COLUMN     "rentalPricePerDay" DOUBLE PRECISION;

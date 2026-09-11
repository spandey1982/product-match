-- AlterTable
ALTER TABLE "hm_leads" ADD COLUMN     "leadType" TEXT NOT NULL DEFAULT 'quote',
ADD COLUMN     "shippingAddress" TEXT;

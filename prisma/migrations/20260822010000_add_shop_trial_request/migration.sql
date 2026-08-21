-- AlterTable
ALTER TABLE "products" ADD COLUMN     "size" TEXT;

-- CreateTable
CREATE TABLE "shop_trial_requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productImage" TEXT,
    "storeName" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "size" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressPincode" TEXT NOT NULL,
    "addressLandmark" TEXT,
    "trialDate" TEXT NOT NULL,
    "trialSlot" TEXT NOT NULL,
    "specialInstructions" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Pay at Doorstep',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_trial_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shop_trial_requests_customerId_idx" ON "shop_trial_requests"("customerId");

-- CreateIndex
CREATE INDEX "shop_trial_requests_productId_idx" ON "shop_trial_requests"("productId");

-- AddForeignKey
ALTER TABLE "shop_trial_requests" ADD CONSTRAINT "shop_trial_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

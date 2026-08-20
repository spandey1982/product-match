-- CreateTable
CREATE TABLE "guest_tryon_usage" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_tryon_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_tryon_usage_deviceId_key" ON "guest_tryon_usage"("deviceId");

-- CreateIndex
CREATE INDEX "guest_tryon_usage_ipAddress_createdAt_idx" ON "guest_tryon_usage"("ipAddress", "createdAt");

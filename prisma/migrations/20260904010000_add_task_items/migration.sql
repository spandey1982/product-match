-- CreateTable
CREATE TABLE "task_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dependencies" TEXT,
    "sourceRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_items_category_status_idx" ON "task_items"("category", "status");

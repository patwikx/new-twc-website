-- CreateEnum
CREATE TYPE "CycleCountType" AS ENUM ('FULL', 'ABC_CLASS_A', 'ABC_CLASS_B', 'ABC_CLASS_C', 'RANDOM', 'SPOT');

-- CreateEnum
CREATE TYPE "CycleCountStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CycleCount" (
    "id" TEXT NOT NULL,
    "countNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" "CycleCountType" NOT NULL,
    "status" "CycleCountStatus" NOT NULL DEFAULT 'DRAFT',
    "blindCount" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "notes" TEXT,
    "totalItems" INTEGER,
    "itemsCounted" INTEGER,
    "itemsWithVariance" INTEGER,
    "totalVarianceCost" DECIMAL(12,2),
    "accuracyPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCountItem" (
    "id" TEXT NOT NULL,
    "cycleCountId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "batchId" TEXT,
    "systemQuantity" DECIMAL(10,3) NOT NULL,
    "countedQuantity" DECIMAL(10,3),
    "variance" DECIMAL(10,3),
    "variancePercent" DECIMAL(7,2),
    "varianceCost" DECIMAL(12,2),
    "unitCost" DECIMAL(10,4),
    "countedById" TEXT,
    "countedAt" TIMESTAMP(3),
    "notes" TEXT,
    "adjustmentMade" BOOLEAN NOT NULL DEFAULT false,
    "adjustmentId" TEXT,

    CONSTRAINT "CycleCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CycleCount_countNumber_key" ON "CycleCount"("countNumber");

-- CreateIndex
CREATE INDEX "CycleCount_warehouseId_idx" ON "CycleCount"("warehouseId");

-- CreateIndex
CREATE INDEX "CycleCount_status_idx" ON "CycleCount"("status");

-- CreateIndex
CREATE INDEX "CycleCount_scheduledAt_idx" ON "CycleCount"("scheduledAt");

-- CreateIndex
CREATE INDEX "CycleCountItem_cycleCountId_idx" ON "CycleCountItem"("cycleCountId");

-- CreateIndex
CREATE INDEX "CycleCountItem_stockItemId_idx" ON "CycleCountItem"("stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCountItem_cycleCountId_stockItemId_batchId_key" ON "CycleCountItem"("cycleCountId", "stockItemId", "batchId");

-- AddForeignKey
ALTER TABLE "CycleCount" ADD CONSTRAINT "CycleCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountItem" ADD CONSTRAINT "CycleCountItem_cycleCountId_fkey" FOREIGN KEY ("cycleCountId") REFERENCES "CycleCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountItem" ADD CONSTRAINT "CycleCountItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCountItem" ADD CONSTRAINT "CycleCountItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StockBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "LandedCostStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LandedCostAllocationBasis" AS ENUM ('BY_VALUE', 'BY_QUANTITY', 'BY_WEIGHT', 'BY_VOLUME', 'MANUAL');

-- CreateEnum
CREATE TYPE "LandedCostExpenseType" AS ENUM ('OCEAN_FREIGHT', 'AIR_FREIGHT', 'CUSTOMS_TAX', 'INSURANCE', 'CUSTOMS_BROKER', 'LOCAL_TRANSPORT', 'PORT_FEES', 'DOCUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "LandedCostPostingTreatment" AS ENUM ('CAPITALIZED', 'EXPENSED');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'LC';

-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'LANDED_COST';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "volumePerUnit" DECIMAL(18,6),
ADD COLUMN     "weightPerUnit" DECIMAL(18,6);

-- CreateTable
CREATE TABLE "landed_costs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lcNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "status" "LandedCostStatus" NOT NULL DEFAULT 'DRAFT',
    "allocationBasis" "LandedCostAllocationBasis" NOT NULL DEFAULT 'BY_VALUE',
    "postingDate" TIMESTAMP(3),
    "currency" "CurrencyCode" NOT NULL DEFAULT 'KWD',
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "cancelledById" TEXT,
    "postedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "inventoryTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landed_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landed_cost_expenses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "landedCostId" TEXT NOT NULL,
    "expenseType" "LandedCostExpenseType" NOT NULL,
    "description" TEXT,
    "currency" "CurrencyCode" NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "baseAmount" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "landed_cost_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landed_cost_lines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "landedCostId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "invoiceValue" DECIMAL(18,6) NOT NULL,
    "weightTotal" DECIMAL(18,6),
    "volumeTotal" DECIMAL(18,6),
    "allocatedAmount" DECIMAL(18,6) NOT NULL,
    "postingTreatment" "LandedCostPostingTreatment",

    CONSTRAINT "landed_cost_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landed_cost_receipts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "landedCostId" TEXT NOT NULL,
    "inventoryTransactionId" TEXT NOT NULL,

    CONSTRAINT "landed_cost_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landed_cost_allocations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "landedCostId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "landed_cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landed_costs_organizationId_status_idx" ON "landed_costs"("organizationId", "status");

-- CreateIndex
CREATE INDEX "landed_costs_organizationId_supplierId_idx" ON "landed_costs"("organizationId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "landed_costs_organizationId_lcNumber_key" ON "landed_costs"("organizationId", "lcNumber");

-- CreateIndex
CREATE INDEX "landed_cost_expenses_organizationId_landedCostId_idx" ON "landed_cost_expenses"("organizationId", "landedCostId");

-- CreateIndex
CREATE INDEX "landed_cost_lines_organizationId_landedCostId_idx" ON "landed_cost_lines"("organizationId", "landedCostId");

-- CreateIndex
CREATE INDEX "landed_cost_lines_organizationId_productId_idx" ON "landed_cost_lines"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "landed_cost_lines_organizationId_warehouseId_idx" ON "landed_cost_lines"("organizationId", "warehouseId");

-- CreateIndex
CREATE INDEX "landed_cost_receipts_inventoryTransactionId_idx" ON "landed_cost_receipts"("inventoryTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "landed_cost_receipts_landedCostId_inventoryTransactionId_key" ON "landed_cost_receipts"("landedCostId", "inventoryTransactionId");

-- CreateIndex
CREATE INDEX "landed_cost_allocations_organizationId_landedCostId_idx" ON "landed_cost_allocations"("organizationId", "landedCostId");

-- CreateIndex
CREATE UNIQUE INDEX "landed_cost_allocations_landedCostId_lineId_expenseId_key" ON "landed_cost_allocations"("landedCostId", "lineId", "expenseId");

-- AddForeignKey
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_expenses" ADD CONSTRAINT "landed_cost_expenses_landedCostId_fkey" FOREIGN KEY ("landedCostId") REFERENCES "landed_costs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_lines" ADD CONSTRAINT "landed_cost_lines_landedCostId_fkey" FOREIGN KEY ("landedCostId") REFERENCES "landed_costs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_receipts" ADD CONSTRAINT "landed_cost_receipts_landedCostId_fkey" FOREIGN KEY ("landedCostId") REFERENCES "landed_costs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_landedCostId_fkey" FOREIGN KEY ("landedCostId") REFERENCES "landed_costs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "landed_cost_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "landed_cost_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

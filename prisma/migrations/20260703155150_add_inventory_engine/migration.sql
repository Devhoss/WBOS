-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('OPENING_BALANCE', 'MANUAL_RECEIPT', 'PURCHASE_RECEIPT', 'SALE', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'DAMAGE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InventoryDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "InventoryTransactionStatus" AS ENUM ('POSTED', 'VOIDED');

-- CreateTable
CREATE TABLE "adjustment_reasons" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "direction" "InventoryDirection",
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "adjustment_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "status" "InventoryTransactionStatus" NOT NULL DEFAULT 'POSTED',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transaction_lines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "fromWarehouseId" TEXT,
    "toWarehouseId" TEXT,
    "adjustmentReasonId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transaction_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ledger_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactionLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "direction" "InventoryDirection" NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adjustment_reasons_organizationId_archivedAt_idx" ON "adjustment_reasons"("organizationId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "adjustment_reasons_organizationId_code_key" ON "adjustment_reasons"("organizationId", "code");

-- CreateIndex
CREATE INDEX "inventory_transactions_organizationId_occurredAt_idx" ON "inventory_transactions"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_organizationId_type_idx" ON "inventory_transactions"("organizationId", "type");

-- CreateIndex
CREATE INDEX "inventory_transactions_organizationId_referenceType_referen_idx" ON "inventory_transactions"("organizationId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_organizationId_transactionId_idx" ON "inventory_transaction_lines"("organizationId", "transactionId");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_organizationId_productId_idx" ON "inventory_transaction_lines"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_organizationId_fromWarehouseId_idx" ON "inventory_transaction_lines"("organizationId", "fromWarehouseId");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_organizationId_toWarehouseId_idx" ON "inventory_transaction_lines"("organizationId", "toWarehouseId");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_adjustmentReasonId_idx" ON "inventory_transaction_lines"("adjustmentReasonId");

-- CreateIndex
CREATE INDEX "inventory_ledger_entries_organizationId_productId_warehouse_idx" ON "inventory_ledger_entries"("organizationId", "productId", "warehouseId");

-- CreateIndex
CREATE INDEX "inventory_ledger_entries_organizationId_warehouseId_idx" ON "inventory_ledger_entries"("organizationId", "warehouseId");

-- CreateIndex
CREATE INDEX "inventory_ledger_entries_organizationId_productId_idx" ON "inventory_ledger_entries"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "inventory_ledger_entries_organizationId_occurredAt_idx" ON "inventory_ledger_entries"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_ledger_entries_transactionId_idx" ON "inventory_ledger_entries"("transactionId");

-- CreateIndex
CREATE INDEX "inventory_ledger_entries_transactionLineId_idx" ON "inventory_ledger_entries"("transactionLineId");

-- AddForeignKey
ALTER TABLE "adjustment_reasons" ADD CONSTRAINT "adjustment_reasons_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "inventory_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_adjustmentReasonId_fkey" FOREIGN KEY ("adjustmentReasonId") REFERENCES "adjustment_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "inventory_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_transactionLineId_fkey" FOREIGN KEY ("transactionLineId") REFERENCES "inventory_transaction_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

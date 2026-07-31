/*
  Warnings:

  - You are about to drop the column `line_type` on the `invoice_lines` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `is_read` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `organization_id` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `line_type` on the `sales_order_lines` table. All the data in the column will be lost.
  - Added the required column `organizationId` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropIndex
DROP INDEX "notifications_org_user_created_idx";

-- DropIndex
DROP INDEX "notifications_org_user_read_idx";

-- AlterTable
ALTER TABLE "inventory_ledger_entries" ADD COLUMN     "totalCost" DECIMAL(18,6),
ADD COLUMN     "unitCost" DECIMAL(18,6);

-- AlterTable
ALTER TABLE "inventory_transaction_lines" ADD COLUMN     "totalCost" DECIMAL(18,6),
ADD COLUMN     "unitCost" DECIMAL(18,6);

-- AlterTable
ALTER TABLE "invoice_lines" DROP COLUMN "line_type",
ADD COLUMN     "lineType" "LineType" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "created_at",
DROP COLUMN "is_read",
DROP COLUMN "organization_id",
DROP COLUMN "user_id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "sales_order_lines" DROP COLUMN "line_type",
ADD COLUMN     "lineType" "LineType" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "product_costs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "averageCost" DECIMAL(18,6) NOT NULL,
    "totalQuantity" DECIMAL(18,6) NOT NULL,
    "totalValue" DECIMAL(18,6) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_costs_organizationId_productId_idx" ON "product_costs"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "product_costs_organizationId_warehouseId_idx" ON "product_costs"("organizationId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "product_costs_organizationId_productId_warehouseId_key" ON "product_costs"("organizationId", "productId", "warehouseId");

-- CreateIndex
CREATE INDEX "inventory_ledger_entries_organizationId_movementType_direct_idx" ON "inventory_ledger_entries"("organizationId", "movementType", "direction");

-- CreateIndex
CREATE INDEX "notifications_organizationId_userId_isRead_idx" ON "notifications"("organizationId", "userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_organizationId_userId_createdAt_idx" ON "notifications"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "shipment_lines_organizationId_unitOfMeasureId_idx" ON "shipment_lines"("organizationId", "unitOfMeasureId");

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

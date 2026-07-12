-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('SELF', 'DUAL');

-- CreateEnum
CREATE TYPE "CycleCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterEnum
BEGIN;
CREATE TYPE "ShipmentStatus_new" AS ENUM ('PENDING_PICK', 'PICKING', 'PICKED', 'LOADED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED');
ALTER TABLE "public"."shipments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "shipments" ALTER COLUMN "status" TYPE "ShipmentStatus_new" USING ("status"::text::"ShipmentStatus_new");
ALTER TYPE "ShipmentStatus" RENAME TO "ShipmentStatus_old";
ALTER TYPE "ShipmentStatus_new" RENAME TO "ShipmentStatus";
DROP TYPE "public"."ShipmentStatus_old";
ALTER TABLE "shipments" ALTER COLUMN "status" SET DEFAULT 'PENDING_PICK';
COMMIT;

-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "address" TEXT,
ADD COLUMN     "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'SELF',
ADD COLUMN     "arabicBusinessName" TEXT,
ADD COLUMN     "commercialRegistration" TEXT,
ADD COLUMN     "documentLanguage" TEXT NOT NULL DEFAULT 'bilingual',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "footer" TEXT,
ADD COLUMN     "logoPath" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "termsAndConditions" TEXT,
ADD COLUMN     "vatNumber" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "invoice_lines" ADD COLUMN     "piecesPerBox" DECIMAL(18,0);

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "deliveryStatus" TEXT,
ADD COLUMN     "discountRate" DECIMAL(18,3),
ADD COLUMN     "discountType" "DiscountType",
ADD COLUMN     "warehouseName" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "piecesPerBox" DECIMAL(18,0);

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "archivedById" TEXT;

-- AlterTable
ALTER TABLE "sales_order_lines" ADD COLUMN     "piecesPerBox" DECIMAL(18,0);

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "discountRate" DECIMAL(18,3),
ADD COLUMN     "discountType" "DiscountType";

-- AlterTable
ALTER TABLE "shipment_lines" DROP COLUMN "pickedById",
DROP COLUMN "verifiedById",
ADD COLUMN     "pickedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "shipments" DROP COLUMN "shippedAt",
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "loadedAt" TIMESTAMP(3),
ADD COLUMN     "outForDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "pickedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING_PICK';

-- CreateTable
CREATE TABLE "cycle_counts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "CycleCountStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "countedById" TEXT,
    "approvedById" TEXT,
    "countedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_count_lines" (
    "id" TEXT NOT NULL,
    "cycleCountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" DECIMAL(18,6) NOT NULL,
    "countedQty" DECIMAL(18,6),
    "variance" DECIMAL(18,6),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cycle_counts_organizationId_status_idx" ON "cycle_counts"("organizationId", "status");

-- CreateIndex
CREATE INDEX "cycle_counts_organizationId_warehouseId_idx" ON "cycle_counts"("organizationId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_counts_organizationId_countNumber_key" ON "cycle_counts"("organizationId", "countNumber");

-- CreateIndex
CREATE INDEX "cycle_count_lines_cycleCountId_idx" ON "cycle_count_lines"("cycleCountId");

-- CreateIndex
CREATE INDEX "cycle_count_lines_organizationId_productId_idx" ON "cycle_count_lines"("organizationId", "productId");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_cycleCountId_fkey" FOREIGN KEY ("cycleCountId") REFERENCES "cycle_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

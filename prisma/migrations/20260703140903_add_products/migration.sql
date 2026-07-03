-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISCONTINUED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT,
    "unitOfMeasureId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "defaultSellingPrice" DECIMAL(18,3),
    "defaultCurrency" "CurrencyCode" NOT NULL DEFAULT 'KWD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_organizationId_sku_idx" ON "products"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "products_organizationId_barcode_idx" ON "products"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "products_organizationId_name_idx" ON "products"("organizationId", "name");

-- CreateIndex
CREATE INDEX "products_organizationId_status_idx" ON "products"("organizationId", "status");

-- CreateIndex
CREATE INDEX "products_organizationId_archivedAt_idx" ON "products"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_supplierId_idx" ON "products"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_sku_key" ON "products"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_barcode_key" ON "products"("organizationId", "barcode");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

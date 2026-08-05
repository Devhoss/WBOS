-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('PROFORMA', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'INSURANCE', 'PAYMENT_RECEIPT', 'OTHER');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'IMP';

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "attachmentType" "AttachmentType" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "import_shipments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'KWD',
    "containerRef" TEXT,
    "vessel" TEXT,
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "etd" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "supplierInvoiceId" TEXT,
    "landedCostId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "import_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_shipment_purchase_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "importShipmentId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_shipment_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_shipments_organizationId_supplierId_idx" ON "import_shipments"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "import_shipments_organizationId_supplierInvoiceId_idx" ON "import_shipments"("organizationId", "supplierInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "import_shipments_organizationId_shipmentNumber_key" ON "import_shipments"("organizationId", "shipmentNumber");

-- CreateIndex
CREATE INDEX "import_shipment_purchase_orders_organizationId_importShipme_idx" ON "import_shipment_purchase_orders"("organizationId", "importShipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "import_shipment_purchase_orders_importShipmentId_purchaseOr_key" ON "import_shipment_purchase_orders"("importShipmentId", "purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "import_shipment_purchase_orders_organizationId_purchaseOrde_key" ON "import_shipment_purchase_orders"("organizationId", "purchaseOrderId");

-- AddForeignKey
ALTER TABLE "import_shipments" ADD CONSTRAINT "import_shipments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_shipments" ADD CONSTRAINT "import_shipments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_shipments" ADD CONSTRAINT "import_shipments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_shipments" ADD CONSTRAINT "import_shipments_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_shipments" ADD CONSTRAINT "import_shipments_landedCostId_fkey" FOREIGN KEY ("landedCostId") REFERENCES "landed_costs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_shipment_purchase_orders" ADD CONSTRAINT "import_shipment_purchase_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_shipment_purchase_orders" ADD CONSTRAINT "import_shipment_purchase_orders_importShipmentId_fkey" FOREIGN KEY ("importShipmentId") REFERENCES "import_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_shipment_purchase_orders" ADD CONSTRAINT "import_shipment_purchase_orders_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

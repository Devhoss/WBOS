-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('OPEN', 'RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('CUSTOMER_CHANGED_MIND', 'DAMAGED', 'WRONG_PRODUCT', 'DEFECTIVE', 'EXPIRED', 'RECALL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('GOOD', 'DAMAGED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReturnDisposition" AS ENUM ('RESTOCK', 'SCRAP', 'REPLACE');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'RN';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'REFUND';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "creditedAmount" DECIMAL(18,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "return_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "invoiceId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'OPEN',
    "reason" "ReturnReason" NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_order_lines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "returnOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "invoiceLineId" TEXT,
    "lineNumber" INTEGER NOT NULL,
    "expectedQuantity" DECIMAL(18,6) NOT NULL,
    "receivedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "disposition" "ReturnDisposition",
    "condition" "ReturnCondition",
    "notes" TEXT,
    "unitPrice" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "return_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "returnOrderId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" "CurrencyCode" NOT NULL DEFAULT 'KWD',
    "totalAmount" DECIMAL(18,3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_lines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,3) NOT NULL,
    "totalPrice" DECIMAL(18,3) NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "unitOfMeasureCode" TEXT NOT NULL,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_orders_organizationId_status_idx" ON "return_orders"("organizationId", "status");

-- CreateIndex
CREATE INDEX "return_orders_organizationId_customerId_idx" ON "return_orders"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "return_orders_organizationId_salesOrderId_idx" ON "return_orders"("organizationId", "salesOrderId");

-- CreateIndex
CREATE INDEX "return_orders_organizationId_invoiceId_idx" ON "return_orders"("organizationId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "return_orders_organizationId_returnNumber_key" ON "return_orders"("organizationId", "returnNumber");

-- CreateIndex
CREATE INDEX "return_order_lines_returnOrderId_idx" ON "return_order_lines"("returnOrderId");

-- CreateIndex
CREATE INDEX "return_order_lines_organizationId_productId_idx" ON "return_order_lines"("organizationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_returnOrderId_key" ON "credit_notes"("returnOrderId");

-- CreateIndex
CREATE INDEX "credit_notes_organizationId_status_idx" ON "credit_notes"("organizationId", "status");

-- CreateIndex
CREATE INDEX "credit_notes_organizationId_invoiceId_idx" ON "credit_notes"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "credit_notes_organizationId_customerId_idx" ON "credit_notes"("organizationId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_organizationId_creditNoteNumber_key" ON "credit_notes"("organizationId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "credit_note_lines_creditNoteId_idx" ON "credit_note_lines"("creditNoteId");

-- CreateIndex
CREATE INDEX "credit_note_lines_organizationId_productId_idx" ON "credit_note_lines"("organizationId", "productId");

-- AddForeignKey
ALTER TABLE "return_orders" ADD CONSTRAINT "return_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_orders" ADD CONSTRAINT "return_orders_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_orders" ADD CONSTRAINT "return_orders_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_orders" ADD CONSTRAINT "return_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_orders" ADD CONSTRAINT "return_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_order_lines" ADD CONSTRAINT "return_order_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_order_lines" ADD CONSTRAINT "return_order_lines_returnOrderId_fkey" FOREIGN KEY ("returnOrderId") REFERENCES "return_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_order_lines" ADD CONSTRAINT "return_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_order_lines" ADD CONSTRAINT "return_order_lines_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_returnOrderId_fkey" FOREIGN KEY ("returnOrderId") REFERENCES "return_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "sales_order_lines" ADD COLUMN     "returnedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0;

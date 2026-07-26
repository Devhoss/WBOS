-- AlterTable
ALTER TABLE "credit_note_lines" ADD COLUMN     "productArabicName" TEXT;

-- AlterTable
ALTER TABLE "invoice_lines" ADD COLUMN     "productArabicName" TEXT;

-- AlterTable
ALTER TABLE "quotation_lines" ADD COLUMN     "productArabicName" TEXT;

-- AlterTable
ALTER TABLE "sales_order_lines" ADD COLUMN     "productArabicName" TEXT;

-- Create LineType enum
CREATE TYPE "LineType" AS ENUM ('NORMAL', 'FREE_SAMPLE');

-- Add lineType to sales_order_lines
ALTER TABLE "sales_order_lines" ADD COLUMN "line_type" "LineType" NOT NULL DEFAULT 'NORMAL';

-- Add lineType to invoice_lines
ALTER TABLE "invoice_lines" ADD COLUMN "line_type" "LineType" NOT NULL DEFAULT 'NORMAL';

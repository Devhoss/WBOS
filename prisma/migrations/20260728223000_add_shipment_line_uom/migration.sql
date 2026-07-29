ALTER TABLE "shipment_lines" ADD COLUMN "unitOfMeasureId" TEXT;
ALTER TABLE "shipment_lines" ADD COLUMN "unitOfMeasureCode" TEXT;

UPDATE "shipment_lines" sl
SET "unitOfMeasureId" = sol."unitOfMeasureId",
    "unitOfMeasureCode" = sol."unitOfMeasureCode"
FROM "sales_order_lines" sol
WHERE sl."salesOrderLineId" = sol."id";

ALTER TABLE "shipment_lines" ALTER COLUMN "unitOfMeasureId" SET NOT NULL;
ALTER TABLE "shipment_lines" ALTER COLUMN "unitOfMeasureCode" SET NOT NULL;

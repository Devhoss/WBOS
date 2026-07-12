import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const goodsReceiptSchema = z.object({
  purchaseOrderId: z.string().trim().min(1, "Purchase order is required."),
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  occurredAt: z.coerce.date().optional(),
  notes: optionalText,
  lines: z
    .array(
      z.object({
        purchaseOrderLineId: z.string().trim().min(1, "Purchase order line is required."),
        productId: z.string().trim().min(1, "Product is required."),
        quantity: z.coerce.number().positive("Quantity must be greater than zero."),
        notes: optionalText,
      }),
    )
    .min(1, "At least one receiving line is required."),
});

export type GoodsReceiptInput = z.infer<typeof goodsReceiptSchema>;

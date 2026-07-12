import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const manualReceiptSchema = z.object({
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  occurredAt: z.coerce.date().optional(),
  notes: optionalText,
  lines: z
    .array(
      z.object({
        productId: z.string().trim().min(1, "Product is required."),
        quantity: z.coerce.number().positive("Quantity must be greater than zero."),
        notes: optionalText,
      }),
    )
    .min(1, "At least one product is required."),
});

export type ManualReceiptInput = z.infer<typeof manualReceiptSchema>;

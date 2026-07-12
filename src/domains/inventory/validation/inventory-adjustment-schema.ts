import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const inventoryAdjustmentSchema = z.object({
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  productId: z.string().trim().min(1, "Product is required."),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  reasonCode: z.string().trim().min(1, "Adjustment reason is required."),
  notes: optionalText,
});

export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;

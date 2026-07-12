import { z } from "zod";

export const cycleCountLineSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  expectedQty: z.coerce.number().positive("Expected quantity must be positive."),
  countedQty: z.coerce.number().nonnegative("Counted quantity cannot be negative.").optional(),
  notes: z.string().optional(),
});

export const createCycleCountSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required."),
  notes: z.string().optional(),
  lines: z.array(cycleCountLineSchema).min(1, "At least one product is required."),
});

export const updateCycleCountLineSchema = z.object({
  lineId: z.string().min(1),
  countedQty: z.coerce.number().nonnegative("Counted quantity cannot be negative."),
  notes: z.string().optional(),
});

export const approveCycleCountSchema = z.object({
  countId: z.string().min(1),
});

export type CreateCycleCountInput = z.infer<typeof createCycleCountSchema>;
export type UpdateCycleCountLineInput = z.infer<typeof updateCycleCountLineSchema>;

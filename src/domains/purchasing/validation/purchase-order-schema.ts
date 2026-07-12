import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const purchaseOrderLineSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  unitOfMeasureId: z.string().trim().min(1, "Unit of measure is required."),
  description: optionalText,
  orderedQuantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative."),
  totalCost: z.coerce.number().min(0, "Total cost cannot be negative."),
  notes: optionalText,
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  currency: z.enum(["KWD", "USD", "EUR"]).default("KWD"),
  subtotal: z.coerce.number().min(0, "Subtotal cannot be negative."),
  taxAmount: z.coerce.number().min(0, "Tax amount cannot be negative.").default(0),
  totalAmount: z.coerce.number().min(0, "Total amount cannot be negative."),
  expectedDeliveryDate: z.coerce.date().optional(),
  deliveryAddress: optionalText,
  notes: optionalText,
  internalNotes: optionalText,
  lines: z
    .array(purchaseOrderLineSchema)
    .min(1, "At least one product line is required."),
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema.extend({
  id: z.string().trim().min(1, "Purchase order is required."),
});

export const updatePurchaseOrderStatusSchema = z.object({
  id: z.string().trim().min(1, "Purchase order is required."),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;

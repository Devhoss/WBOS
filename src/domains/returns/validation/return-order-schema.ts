import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const returnOrderLineSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  unitOfMeasureId: z.string().trim().min(1, "Unit of measure is required."),
  invoiceLineId: z.string().trim().optional(),
  expectedQuantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative."),
  notes: optionalText,
});

export const createReturnOrderSchema = z.object({
  salesOrderId: z.string().trim().optional(),
  invoiceId: z.string().trim().optional(),
  customerId: z.string().trim().min(1, "Customer is required."),
  reason: z.enum([
    "CUSTOMER_CHANGED_MIND",
    "DAMAGED",
    "WRONG_PRODUCT",
    "DEFECTIVE",
    "EXPIRED",
    "RECALL",
    "OTHER",
  ]),
  notes: optionalText,
  lines: z.array(returnOrderLineSchema).min(1, "At least one product line is required."),
});

export const receiveReturnSchema = z.object({
  id: z.string().trim().min(1, "Return is required."),
  lines: z.array(
    z.object({
      lineId: z.string().trim().min(1),
      receivedQuantity: z.coerce.number().min(0, "Received quantity cannot be negative."),
      condition: z.enum(["GOOD", "DAMAGED", "EXPIRED"]).optional(),
    }),
  ),
});

export const completeReturnSchema = z.object({
  id: z.string().trim().min(1, "Return is required."),
  warehouseId: z.string().trim().min(1, "Warehouse is required for inventory posting."),
  lines: z.array(
    z.object({
      lineId: z.string().trim().min(1),
      disposition: z.enum(["RESTOCK", "SCRAP", "REPLACE"]),
      condition: z.enum(["GOOD", "DAMAGED", "EXPIRED"]).optional(),
    }),
  ),
});

export const cancelReturnSchema = z.object({
  id: z.string().trim().min(1, "Return is required."),
  reason: optionalText,
});

export type CreateReturnOrderInput = z.infer<typeof createReturnOrderSchema>;
export type ReceiveReturnInput = z.infer<typeof receiveReturnSchema>;
export type CompleteReturnInput = z.infer<typeof completeReturnSchema>;
export type CancelReturnInput = z.infer<typeof cancelReturnSchema>;

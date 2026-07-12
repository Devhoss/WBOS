import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const createShipmentSchema = z.object({
  salesOrderId: z.string().trim().min(1, "Sales order is required."),
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  notes: optionalText,
  lines: z
    .array(
      z.object({
        salesOrderLineId: z.string().trim().min(1, "Sales order line is required."),
        productId: z.string().trim().min(1, "Product is required."),
        quantity: z.coerce.number().positive("Quantity must be greater than zero."),
        productName: z.string().trim().min(1, "Product name is required."),
        productSku: z.string().trim().min(1, "Product SKU is required."),
        notes: optionalText,
      }),
    )
    .min(1, "At least one shipment line is required."),
});

export const shipmentStatusActionSchema = z.object({
  id: z.string().trim().min(1, "Shipment is required."),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

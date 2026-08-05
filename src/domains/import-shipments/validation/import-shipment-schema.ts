import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const createImportShipmentSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  currency: z.enum(["KWD", "USD", "EUR"]).default("KWD"),
  containerRef: optionalText,
  vessel: optionalText,
  portOfLoading: optionalText,
  portOfDischarge: optionalText,
  etd: z.coerce.date().optional(),
  eta: z.coerce.date().optional(),
  notes: optionalText,
});

export const updateImportShipmentSchema = createImportShipmentSchema.extend({
  id: z.string().trim().min(1, "Import shipment is required."),
});

export const importShipmentIdSchema = z.object({
  id: z.string().trim().min(1, "Import shipment is required."),
});

export const linkPurchaseOrderSchema = z.object({
  importShipmentId: z.string().trim().min(1, "Import shipment is required."),
  purchaseOrderId: z.string().trim().min(1, "Purchase order is required."),
});

export const linkSupplierInvoiceSchema = z.object({
  importShipmentId: z.string().trim().min(1, "Import shipment is required."),
  supplierInvoiceId: z.string().trim().min(1, "Supplier invoice is required."),
});

export const linkLandedCostSchema = z.object({
  importShipmentId: z.string().trim().min(1, "Import shipment is required."),
  landedCostId: z.string().trim().min(1, "Landed cost is required."),
});

export type CreateImportShipmentInput = z.infer<typeof createImportShipmentSchema>;
export type UpdateImportShipmentInput = z.infer<typeof updateImportShipmentSchema>;
export type LinkPurchaseOrderInput = z.infer<typeof linkPurchaseOrderSchema>;
export type LinkSupplierInvoiceInput = z.infer<typeof linkSupplierInvoiceSchema>;
export type LinkLandedCostInput = z.infer<typeof linkLandedCostSchema>;
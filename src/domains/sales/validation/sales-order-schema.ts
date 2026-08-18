import { z } from "zod";

import {
  enforceLineDocumentTotals,
  SALES_LINE_FIELDS,
} from "@/shared/money/document-schema";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const salesOrderLineSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  unitOfMeasureId: z.string().trim().min(1, "Unit of measure is required."),
  orderedQuantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative."),
  totalPrice: z.coerce.number().min(0, "Total price cannot be negative."),
  productName: z.string().trim().min(1, "Product name is required."),
  productSku: z.string().trim().min(1, "Product SKU is required."),
  unitOfMeasureCode: z.string().trim().min(1, "Unit of measure code is required."),
  piecesPerBox: z.coerce.number().min(0).optional(),
  description: optionalText,
  notes: optionalText,
  lineType: z.enum(["NORMAL", "FREE_SAMPLE"]).default("NORMAL"),
})
  /**
   * A FREE_SAMPLE line is zero-priced by definition. Until now this was only
   * enforced by the web form (which blanks the price inputs when the checkbox
   * is ticked) and again at invoice generation. Any other caller — the mobile
   * client, a script, a hand-rolled request — could persist a priced
   * free-sample line, which then appeared on the sales order at full price but
   * was silently zeroed on the invoice, so the invoice header no longer matched
   * the sum of its own lines.
   *
   * Normalising here makes the rule hold at every entry point.
   *
   * NOTE: this deliberately does NOT recompute the order's subtotal/tax/total.
   * Those remain client-supplied (audit finding H4) and are tracked separately;
   * fixing them requires establishing the server-authoritative calculation,
   * which is out of scope for this change.
   */
  .transform((line) =>
    line.lineType === "FREE_SAMPLE"
      ? { ...line, unitPrice: 0, totalPrice: 0 }
      : line,
  );

const createSalesOrderBaseSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  currency: z.enum(["KWD", "USD", "EUR"]).default("KWD"),
  subtotal: z.coerce.number().min(0, "Subtotal cannot be negative."),
  taxAmount: z.coerce.number().min(0, "Tax amount cannot be negative.").default(0),
  totalAmount: z.coerce.number().min(0, "Total amount cannot be negative."),
  discountAmount: z.coerce.number().min(0, "Discount cannot be negative.").default(0),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountRate: z.coerce.number().min(0, "Discount rate cannot be negative.").optional(),
  expectedShipDate: z.coerce.date().optional(),
  deliveryAddress: optionalText,
  notes: optionalText,
  internalNotes: optionalText,
  customerReference: optionalText,
  lines: z.array(salesOrderLineSchema).min(1, "At least one product line is required."),
});

/**
 * The server derives every money figure and rejects a caller whose own
 * arithmetic disagrees. Applied to create and update alike: editing a draft is
 * a second write path to the same rows, and enforcing only on create would make
 * the edit form the way around the rule.
 */
export const createSalesOrderSchema = createSalesOrderBaseSchema.transform((value, ctx) =>
  enforceLineDocumentTotals(value, ctx, SALES_LINE_FIELDS),
);

export const updateSalesOrderSchema = createSalesOrderBaseSchema
  .extend({ id: z.string().trim().min(1, "Sales order is required.") })
  .transform((value, ctx) => enforceLineDocumentTotals(value, ctx, SALES_LINE_FIELDS));

export const salesOrderStatusActionSchema = z.object({
  id: z.string().trim().min(1, "Sales order is required."),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;

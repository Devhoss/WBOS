import { z } from "zod";

import { enforceHeaderDocumentTotals } from "@/shared/money/document-schema";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const createSupplierInvoiceBaseSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  currency: z.enum(["KWD", "USD", "EUR"]).default("KWD"),
  subtotal: z.coerce.number().min(0, "Subtotal cannot be negative."),
  taxAmount: z.coerce.number().min(0, "Tax amount cannot be negative.").default(0),
  totalAmount: z.coerce.number().min(0, "Total amount cannot be negative."),
  reference: optionalText,
  dueDate: z.coerce.date().optional(),
  notes: optionalText,
});

/**
 * A supplier invoice has no lines: the operator types the subtotal straight off
 * the supplier's paper invoice, so the subtotal is a genuine input. Only the
 * total is derived.
 */
export const createSupplierInvoiceSchema = createSupplierInvoiceBaseSchema.transform(
  (value, ctx) => enforceHeaderDocumentTotals(value, ctx),
);

export const updateSupplierInvoiceSchema = createSupplierInvoiceBaseSchema
  .extend({ id: z.string().trim().min(1, "Supplier invoice is required.") })
  .transform((value, ctx) => enforceHeaderDocumentTotals(value, ctx));

export const supplierInvoiceIdSchema = z.object({
  id: z.string().trim().min(1, "Supplier invoice is required."),
});

export const recordSupplierPaymentSchema = z.object({
  supplierInvoiceId: z.string().trim().min(1, "Supplier invoice is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  currency: z.enum(["KWD", "USD", "EUR"]).default("KWD"),
  method: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER", "CREDIT_CARD"]),
  reference: optionalText,
  paidAt: z.coerce.date().optional(),
  notes: optionalText,
});

export type CreateSupplierInvoiceInput = z.infer<typeof createSupplierInvoiceSchema>;
export type UpdateSupplierInvoiceInput = z.infer<typeof updateSupplierInvoiceSchema>;
export type RecordSupplierPaymentInput = z.infer<typeof recordSupplierPaymentSchema>;
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const quotationLineSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  unitOfMeasureId: z.string().trim().min(1, "Unit of measure is required."),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative."),
  totalPrice: z.coerce.number().min(0, "Total price cannot be negative."),
  productName: z.string().trim().min(1, "Product name is required."),
  productSku: z.string().trim().min(1, "Product SKU is required."),
  unitOfMeasureCode: z.string().trim().min(1, "Unit of measure code is required."),
  piecesPerBox: z.coerce.number().optional(),
  productBarcode: z.string().optional(),
  description: optionalText,
  notes: optionalText,
});

export const createQuotationSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  currency: z.enum(["KWD", "USD", "EUR"]).default("KWD"),
  subtotal: z.coerce.number().min(0, "Subtotal cannot be negative."),
  taxAmount: z.coerce.number().min(0, "Tax amount cannot be negative.").default(0),
  totalAmount: z.coerce.number().min(0, "Total amount cannot be negative."),
  discountAmount: z.coerce.number().min(0, "Discount cannot be negative.").default(0),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountRate: z.coerce.number().min(0, "Discount rate cannot be negative.").optional(),
  validUntil: z.coerce.date().optional(),
  notes: optionalText,
  terms: optionalText,
  lines: z.array(quotationLineSchema).min(1, "At least one product line is required."),
});

export const updateQuotationSchema = createQuotationSchema.extend({
  id: z.string().trim().min(1, "Quotation is required."),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;

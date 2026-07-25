import { z } from "zod";

export const issueCreditNoteSchema = z.object({
  invoiceId: z.string().trim().min(1, "Invoice is required."),
  returnOrderId: z.string().trim().optional(),
  customerId: z.string().trim().min(1, "Customer is required."),
  reason: z.string().trim().optional(),
  lines: z
    .array(
      z.object({
        invoiceLineId: z.string().trim().min(1),
        productId: z.string().trim().min(1),
        unitOfMeasureId: z.string().trim().min(1),
        quantity: z.coerce.number().positive("Quantity must be greater than zero."),
        unitPrice: z.coerce.number().min(0, "Unit price cannot be negative."),
        totalPrice: z.coerce.number().min(0, "Total price cannot be negative."),
        productName: z.string().trim().min(1),
        productSku: z.string().trim().min(1),
        unitOfMeasureCode: z.string().trim().min(1),
      }),
    )
    .min(1, "At least one line is required."),
});

export const cancelCreditNoteSchema = z.object({
  id: z.string().trim().min(1, "Credit note is required."),
  reason: z.string().trim().optional(),
});

export type IssueCreditNoteInput = z.infer<typeof issueCreditNoteSchema>;
export type CancelCreditNoteInput = z.infer<typeof cancelCreditNoteSchema>;

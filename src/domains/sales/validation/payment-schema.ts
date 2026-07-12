import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const recordPaymentSchema = z.object({
  invoiceId: z.string().trim().min(1, "Invoice is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  currency: z.enum(["KWD", "USD", "EUR"]).default("KWD"),
  method: z.enum(["CASH", "CHEQUE", "BANK_TRANSFER", "CREDIT_CARD"]),
  reference: optionalText,
  paidAt: z.coerce.date().optional(),
  notes: optionalText,
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

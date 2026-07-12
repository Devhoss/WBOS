import { z } from "zod";

export const generateInvoiceSchema = z.object({
  salesOrderId: z.string().trim().min(1, "Sales order is required."),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

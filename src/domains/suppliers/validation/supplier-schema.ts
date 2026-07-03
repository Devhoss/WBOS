import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const optionalEmail = optionalText.refine((value) => !value || z.string().email().safeParse(value).success, {
  message: "Enter a valid email address.",
});

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required.").max(120),
  code: optionalText.refine((value) => !value || /^[A-Z0-9-]+$/.test(value), {
    message: "Use uppercase letters, numbers, and hyphens only.",
  }),
  contactName: optionalText,
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  paymentTerms: optionalText,
  leadTimeDays: z.coerce.number().int().min(0).max(365).optional().or(z.literal("").transform(() => undefined)),
  notes: optionalText,
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

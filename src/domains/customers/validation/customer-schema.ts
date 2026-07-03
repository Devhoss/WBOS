import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const optionalEmail = optionalText.refine((value) => !value || z.string().email().safeParse(value).success, {
  message: "Enter a valid email address.",
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "Customer name is required.").max(120),
  code: optionalText.refine((value) => !value || /^[A-Z0-9-]+$/.test(value), {
    message: "Use uppercase letters, numbers, and hyphens only.",
  }),
  contactName: optionalText,
  email: optionalEmail,
  phone: optionalText,
  address: optionalText,
  paymentTerms: optionalText,
  creditLimit: z
    .union([
      z.literal("").transform(() => undefined),
      z.coerce.number().min(0, "Credit limit cannot be negative."),
    ])
    .optional(),
  notes: optionalText,
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

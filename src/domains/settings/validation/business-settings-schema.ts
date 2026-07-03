import { z } from "zod";

export const updateBusinessSettingsSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required.").max(120),
  defaultCurrency: z.enum(["KWD", "USD", "EUR"]),
  timezone: z.string().trim().min(2, "Timezone is required.").max(80),
  invoicePrefix: z
    .string()
    .trim()
    .min(1, "Invoice prefix is required.")
    .max(8, "Invoice prefix must be 8 characters or fewer.")
    .regex(/^[A-Z0-9]+$/, "Use uppercase letters and numbers only."),
});

export type UpdateBusinessSettingsInput = z.infer<typeof updateBusinessSettingsSchema>;

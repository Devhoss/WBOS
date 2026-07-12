import { z } from "zod";

export const updateBusinessSettingsSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required.").max(120),
  arabicBusinessName: z.string().trim().max(120).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  vatNumber: z.string().trim().max(50).optional().or(z.literal("")),
  commercialRegistration: z.string().trim().max(50).optional().or(z.literal("")),
  footer: z.string().trim().max(500).optional().or(z.literal("")),
  termsAndConditions: z.string().trim().max(2000).optional().or(z.literal("")),
  defaultCurrency: z.enum(["KWD", "USD", "EUR"]),
  timezone: z.string().trim().min(2, "Timezone is required.").max(80),
  invoicePrefix: z.string().trim().min(1).max(8).regex(/^[A-Z0-9]+$/, "Use uppercase letters and numbers only."),
  approvalMode: z.enum(["SELF", "DUAL"]),
  documentLanguage: z.enum(["english", "arabic", "bilingual"]),
});

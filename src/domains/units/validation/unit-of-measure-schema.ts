import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const createUnitOfMeasureSchema = z.object({
  name: z.string().trim().min(1, "Unit name is required.").max(80),
  code: z
    .string()
    .trim()
    .min(1, "Unit code is required.")
    .max(12, "Unit code must be 12 characters or fewer.")
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers, and hyphens only."),
  description: optionalText,
  isBaseUnit: z.boolean().default(false),
  conversionToBase: z.coerce.number().positive("Conversion must be greater than zero."),
});

export type CreateUnitOfMeasureInput = z.infer<typeof createUnitOfMeasureSchema>;

import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(100),
  code: optionalText.refine((value) => !value || /^[A-Z0-9-]+$/.test(value), {
    message: "Use uppercase letters, numbers, and hyphens only.",
  }),
  description: optionalText,
  parentId: optionalText,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

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

export const updateCategorySchema = createCategorySchema.extend({
  id: z.string().trim().min(1, "Category is required."),
});

const categoryIdSchema = z.object({
  id: z.string().trim().min(1, "Category is required."),
});

export const archiveCategorySchema = categoryIdSchema;
export const activateCategorySchema = categoryIdSchema;
export const deleteCategorySchema = categoryIdSchema;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const productDetailsSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required.")
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers, and hyphens only."),
  barcode: optionalText.refine((value) => !value || /^[A-Za-z0-9-]+$/.test(value), {
    message: "Barcode may contain letters, numbers, and hyphens only.",
  }),
  name: z.string().trim().min(2, "Product name is required.").max(160),
  description: optionalText,
  categoryId: z.string().trim().min(1, "Category is required."),
  supplierId: optionalText,
  unitOfMeasureId: z.string().trim().min(1, "Unit of measure is required."),
  status: z.enum(["DRAFT", "ACTIVE", "DISCONTINUED", "ARCHIVED"]).default("DRAFT"),
  defaultSellingPrice: z
    .union([
      z.literal("").transform(() => undefined),
      z.coerce.number().min(0, "Default selling price cannot be negative."),
    ])
    .optional(),
  defaultCurrency: z.enum(["KWD", "USD", "EUR"]).default("KWD"),
});

export const createProductSchema = productDetailsSchema.extend({
  status: z.enum(["DRAFT", "ACTIVE", "DISCONTINUED"]).default("DRAFT"),
});

export const updateProductSchema = productDetailsSchema.extend({
  id: z.string().trim().min(1, "Product is required."),
});

const productIdSchema = z.object({
  id: z.string().trim().min(1, "Product is required."),
});

export const archiveProductSchema = productIdSchema;
export const activateProductSchema = productIdSchema;
export const deleteProductSchema = productIdSchema;

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

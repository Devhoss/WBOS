import { z } from "zod";

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(2, "Warehouse name is required.").max(100),
  code: z
    .string()
    .trim()
    .min(2, "Warehouse code is required.")
    .max(12, "Warehouse code must be 12 characters or fewer.")
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers, and hyphens only."),
  address: z.string().trim().max(240).optional(),
  isDefault: z.boolean().default(false),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;

export const updateWarehouseSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Warehouse name is required.").max(100),
  code: z
    .string()
    .trim()
    .min(2, "Warehouse code is required.")
    .max(12, "Warehouse code must be 12 characters or fewer.")
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers, and hyphens only."),
  address: z.string().trim().max(240).optional(),
  isDefault: z.boolean().default(false),
});

export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

const idSchema = z.object({ id: z.string().min(1) });

export const archiveWarehouseSchema = idSchema;
export const activateWarehouseSchema = idSchema;
export const deleteWarehouseSchema = idSchema;

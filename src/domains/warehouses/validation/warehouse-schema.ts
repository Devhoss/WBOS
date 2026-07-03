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

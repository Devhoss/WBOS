import { z } from "zod";

export const dateRangeSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
});

export const reportFiltersSchema = z.object({
  dateRange: dateRangeSchema,
  warehouseId: z.string().nullable().default(null),
  customerId: z.string().nullable().default(null),
  supplierId: z.string().nullable().default(null),
  search: z.string().default(""),
});

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;

import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const landedCostExpenseSchema = z.object({
  expenseType: z.enum([
    "OCEAN_FREIGHT",
    "AIR_FREIGHT",
    "CUSTOMS_TAX",
    "INSURANCE",
    "CUSTOMS_BROKER",
    "LOCAL_TRANSPORT",
    "PORT_FEES",
    "DOCUMENTATION",
    "OTHER",
  ]),
  description: optionalText,
  currency: z.enum(["KWD", "USD", "EUR"]),
  exchangeRate: z.coerce.number().positive("Exchange rate must be greater than zero."),
  amount: z.coerce.number().positive("Expense amount must be greater than zero."),
});

export const landedCostCreateSchema = z.object({
  supplierId: optionalText,
  allocationBasis: z
    .enum(["BY_VALUE", "BY_QUANTITY", "BY_WEIGHT", "BY_VOLUME", "MANUAL"])
    .default("BY_VALUE"),
  postingDate: z.coerce.date().optional(),
  currency: z.enum(["KWD", "USD", "EUR"]).default("KWD"),
  exchangeRate: z.coerce.number().positive("Exchange rate must be greater than zero.").default(1),
  notes: optionalText,
  expenses: z
    .array(landedCostExpenseSchema)
    .min(1, "At least one expense is required."),
  receiptTransactionIds: z
    .array(z.string().trim().min(1, "Goods receipt is required."))
    .min(1, "Link at least one goods receipt."),
});

const landedCostLineUpdateSchema = z.object({
  id: z.string().trim().min(1, "Line is required."),
  invoiceValue: z.coerce.number().min(0, "Invoice value cannot be negative."),
  weightTotal: z.coerce.number().min(0, "Weight cannot be negative.").optional(),
  volumeTotal: z.coerce.number().min(0, "Volume cannot be negative.").optional(),
  allocatedAmount: z.coerce.number().min(0, "Allocated amount cannot be negative.").optional(),
});

export const landedCostUpdateSchema = z.object({
  id: z.string().trim().min(1, "Landed cost is required."),
  supplierId: optionalText,
  allocationBasis: z
    .enum(["BY_VALUE", "BY_QUANTITY", "BY_WEIGHT", "BY_VOLUME", "MANUAL"])
    .optional(),
  postingDate: z.coerce.date().optional(),
  currency: z.enum(["KWD", "USD", "EUR"]).optional(),
  exchangeRate: z.coerce.number().positive("Exchange rate must be greater than zero.").optional(),
  notes: optionalText,
  expenses: z.array(landedCostExpenseSchema).min(1, "At least one expense is required.").optional(),
  lines: z.array(landedCostLineUpdateSchema).min(1, "At least one line is required.").optional(),
});

export type LandedCostCreateInput = z.infer<typeof landedCostCreateSchema>;
export type LandedCostUpdateInput = z.infer<typeof landedCostUpdateSchema>;

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { LandedCostService } from "../services/landed-cost-service";

const saveAllocationsSchema = z.object({
  id: z.string().trim().min(1, "Landed cost is required."),
  cells: z
    .array(
      z.object({
        lineId: z.string().trim().min(1, "Line is required."),
        expenseId: z.string().trim().min(1, "Expense is required."),
        amount: z.coerce.number().min(0, "Allocated amount cannot be negative."),
      }),
    )
    .min(1, "Allocate at least one cell."),
});

export async function saveLandedCostAllocations(input: unknown) {
  const parsed = saveAllocationsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid allocation.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    const landedCost = await new LandedCostService().saveAllocations(context, parsed.data.id, parsed.data.cells);
    revalidatePath(`/purchasing/landed-costs/${parsed.data.id}`);
    revalidatePath(`/purchasing/landed-costs/${parsed.data.id}/allocate`);

    return { ok: true, id: landedCost.id };
  } catch (error) {
    if (error instanceof BusinessError) {
      return {
        ok: false,
        message: error.message,
      };
    }

    throw error;
  }
}

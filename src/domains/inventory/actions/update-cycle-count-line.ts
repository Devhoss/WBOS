"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { CycleCountService } from "../services/cycle-count-service";
import { updateCycleCountLineSchema } from "../validation/cycle-count-schema";

export async function updateCycleCountLine(input: unknown) {
  const parsed = updateCycleCountLineSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "WAREHOUSE");

    const line = await new CycleCountService().updateLine(context, parsed.data);
    revalidatePath("/inventory/cycle-counts");

    return { ok: true, data: { id: line.id } };
  } catch (error) {
    if (error instanceof BusinessError) return { ok: false, message: error.message };
    throw error;
  }
}

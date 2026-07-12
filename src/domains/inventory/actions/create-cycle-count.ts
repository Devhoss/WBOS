"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { CycleCountService } from "../services/cycle-count-service";
import { createCycleCountSchema } from "../validation/cycle-count-schema";

export async function createCycleCount(input: unknown) {
  const parsed = createCycleCountSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "WAREHOUSE");

    const count = await new CycleCountService().create(context, parsed.data);
    revalidatePath("/inventory/cycle-counts");

    return { ok: true, data: { id: count.id } };
  } catch (error) {
    if (error instanceof BusinessError) return { ok: false, message: error.message };
    throw error;
  }
}

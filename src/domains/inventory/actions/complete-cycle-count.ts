"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { CycleCountService } from "../services/cycle-count-service";

export async function completeCycleCount(input: { countId: string }) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "WAREHOUSE");

    await new CycleCountService().complete(context, input.countId);
    revalidatePath("/inventory/cycle-counts");

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) return { ok: false, message: error.message };
    throw error;
  }
}

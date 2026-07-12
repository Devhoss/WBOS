"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { UnitOfMeasureService } from "../services/unit-of-measure-service";
import { updateUnitOfMeasureSchema } from "../validation/unit-of-measure-schema";

export async function updateUnitOfMeasure(input: unknown) {
  const parsed = updateUnitOfMeasureSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid unit of measure details.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    await new UnitOfMeasureService().update(context, parsed.data);
    revalidatePath("/units");

    return { ok: true };
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

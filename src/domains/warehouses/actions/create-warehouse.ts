"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { WarehouseService } from "../services/warehouse-service";
import { createWarehouseSchema } from "../validation/warehouse-schema";

export async function createWarehouse(input: unknown) {
  const parsed = createWarehouseSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid warehouse details.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    await new WarehouseService().create(context, parsed.data);
    revalidatePath("/warehouses");

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

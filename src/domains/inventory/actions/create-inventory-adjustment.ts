"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { InventoryAdjustmentService } from "../services/inventory-adjustment-service";
import { inventoryAdjustmentSchema } from "../validation/inventory-adjustment-schema";

export async function createInventoryAdjustment(input: unknown) {
  const parsed = inventoryAdjustmentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid inventory adjustment.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    await new InventoryAdjustmentService().adjust(context, parsed.data);
    revalidatePath("/inventory/adjustments");
    revalidatePath("/inventory");

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

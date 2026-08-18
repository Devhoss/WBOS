"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { WarehouseTransferService } from "../services/warehouse-transfer-service";
import { warehouseTransferSchema } from "../validation/warehouse-transfer-schema";

export async function createWarehouseTransfer(input: unknown) {
  const parsed = warehouseTransferSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid warehouse transfer.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    await new WarehouseTransferService().transfer(context, parsed.data);
    revalidatePath("/inventory/transfers");
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

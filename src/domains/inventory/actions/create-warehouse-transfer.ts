"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { WarehouseTransferService } from "../services/warehouse-transfer-service";
import { warehouseTransferSchema } from "../validation/warehouse-transfer-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "WAREHOUSE"]);

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

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to transfer inventory.", "FORBIDDEN");
    }

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

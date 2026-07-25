"use server";

import { revalidatePath } from "next/cache";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { ReturnOrderService } from "../services/return-order-service";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER"]);

export async function cancelReturnAction(id: string, reason?: string) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to cancel returns.", "FORBIDDEN");
    }

    await new ReturnOrderService().cancel(context, id, reason);
    revalidatePath("/returns");

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

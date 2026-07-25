"use server";

import { revalidatePath } from "next/cache";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { ReturnOrderService } from "../services/return-order-service";
import { createReturnOrderSchema } from "../validation/return-order-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "SALES"]);

export async function createReturnAction(input: unknown) {
  const parsed = createReturnOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid return." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to create returns.", "FORBIDDEN");
    }

    const result = await new ReturnOrderService().create(context, parsed.data);
    revalidatePath("/returns");

    return { ok: true, data: { id: result.id } };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

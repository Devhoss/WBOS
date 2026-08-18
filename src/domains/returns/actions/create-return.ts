"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { ReturnOrderService } from "../services/return-order-service";
import { createReturnOrderSchema } from "../validation/return-order-schema";

export async function createReturnAction(input: unknown) {
  const parsed = createReturnOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid return." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

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

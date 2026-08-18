"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { ReturnOrderService } from "../services/return-order-service";
import { completeReturnSchema } from "../validation/return-order-schema";

export async function completeReturnAction(input: unknown) {
  const parsed = completeReturnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid complete data." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    await new ReturnOrderService().complete(context, parsed.data);
    revalidatePath("/returns");

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

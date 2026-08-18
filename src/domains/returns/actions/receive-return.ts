"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { ReturnOrderService } from "../services/return-order-service";
import { receiveReturnSchema } from "../validation/return-order-schema";

export async function receiveReturnAction(input: unknown) {
  const parsed = receiveReturnSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid receive data." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    await new ReturnOrderService().receive(context, parsed.data.id, parsed.data.lines);
    revalidatePath("/returns");

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

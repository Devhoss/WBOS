"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { PurchaseOrderService } from "../services/purchase-order-service";
import { createPurchaseOrderSchema } from "../validation/purchase-order-schema";

export async function createPurchaseOrder(input: unknown) {
  const parsed = createPurchaseOrderSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid purchase order.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    await new PurchaseOrderService().create(context, parsed.data);
    revalidatePath("/purchasing");
    revalidatePath("/purchasing/orders");

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

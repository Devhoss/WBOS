"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { PurchaseOrderService } from "../services/purchase-order-service";
import { createPurchaseOrderSchema } from "../validation/purchase-order-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER"]);

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

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to create purchase orders.", "FORBIDDEN");
    }

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

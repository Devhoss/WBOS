"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { PurchaseOrderService } from "../services/purchase-order-service";
import { updatePurchaseOrderStatusSchema } from "../validation/purchase-order-schema";

export async function archivePurchaseOrder(input: unknown) {
  const parsed = updatePurchaseOrderStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!new Set(["OWNER", "ADMIN"]).has(context.role)) {
      throw new BusinessError("You do not have permission to archive purchase orders.", "FORBIDDEN");
    }

    await new PurchaseOrderService().archive(context, parsed.data.id);
    revalidatePath("/purchasing");
    revalidatePath("/purchasing/orders");

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
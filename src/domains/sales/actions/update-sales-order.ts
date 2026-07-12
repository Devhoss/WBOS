"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SalesOrderService } from "../services/sales-order-service";
import { updateSalesOrderSchema } from "../validation/sales-order-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "SALES"]);

export async function updateSalesOrderAction(input: unknown) {
  const parsed = updateSalesOrderSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid sales order.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to edit sales orders.", "FORBIDDEN");
    }

    await new SalesOrderService().update(context, parsed.data);
    revalidatePath("/sales");
    revalidatePath("/sales/orders");

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

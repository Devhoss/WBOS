"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SalesOrderService } from "../services/sales-order-service";
import { createSalesOrderSchema } from "../validation/sales-order-schema";

export async function createSalesOrderAction(input: unknown) {
  const parsed = createSalesOrderSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid sales order.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    const result = await new SalesOrderService().create(context, parsed.data);
    revalidatePath("/sales");
    revalidatePath("/sales/orders");

    if (result.creditLimitWarning) {
      return {
        ok: true,
        data: { id: result.order.id },
        warning: result.creditLimitWarning,
      };
    }

    return { ok: true, data: { id: result.order.id } };
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

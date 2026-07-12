"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SalesOrderService } from "../services/sales-order-service";
import { createSalesOrderSchema } from "../validation/sales-order-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "SALES"]);

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

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to create sales orders.", "FORBIDDEN");
    }

    const result = await new SalesOrderService().create(context, parsed.data);
    revalidatePath("/sales");
    revalidatePath("/sales/orders");

    if (result.creditLimitWarning) {
      return {
        ok: true,
        warning: result.creditLimitWarning,
      };
    }

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

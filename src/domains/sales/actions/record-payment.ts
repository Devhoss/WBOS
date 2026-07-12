"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { PaymentService } from "../services/payment-service";
import { recordPaymentSchema } from "../validation/payment-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "FINANCE"]);

export async function recordPaymentAction(input: unknown) {
  const parsed = recordPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid payment.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to record payments.", "FORBIDDEN");
    }

    await new PaymentService().record(context, parsed.data);
    revalidatePath("/invoices");
    revalidatePath("/payments");
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

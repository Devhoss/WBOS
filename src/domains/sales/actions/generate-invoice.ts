"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { InvoiceService } from "../services/invoice-service";
import { generateInvoiceSchema } from "../validation/invoice-schema";

export async function generateInvoiceAction(input: unknown) {
  const parsed = generateInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    await new InvoiceService().generateFromOrder(context, parsed.data.salesOrderId);
    revalidatePath("/sales");
    revalidatePath("/sales/orders");
    revalidatePath("/invoices");

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

"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SupplierInvoiceService } from "../services/supplier-invoice-service";
import { recordSupplierPaymentSchema } from "../validation/supplier-invoice-schema";

export async function recordSupplierPayment(input: unknown) {
  const parsed = recordSupplierPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid payment." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    await new SupplierInvoiceService().recordPayment(context, parsed.data);

    revalidatePath("/purchasing/supplier-invoices");
    revalidatePath(`/purchasing/supplier-invoices/${parsed.data.supplierInvoiceId}`);

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
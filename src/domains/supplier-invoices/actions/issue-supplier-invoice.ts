"use server";

import { revalidatePath } from "next/cache";

import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SupplierInvoiceService } from "../services/supplier-invoice-service";
import { supplierInvoiceIdSchema } from "../validation/supplier-invoice-schema";

export async function issueSupplierInvoice(input: unknown) {
  const parsed = supplierInvoiceIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid supplier invoice." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    await new SupplierInvoiceService().issue(context, parsed.data.id);

    revalidatePath("/purchasing/supplier-invoices");
    revalidatePath(`/purchasing/supplier-invoices/${parsed.data.id}`);

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
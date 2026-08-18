"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SupplierInvoiceService } from "../services/supplier-invoice-service";
import { updateSupplierInvoiceSchema } from "../validation/supplier-invoice-schema";

export async function updateSupplierInvoice(input: unknown) {
  const parsed = updateSupplierInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid supplier invoice." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    await new SupplierInvoiceService().update(context, parsed.data);

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
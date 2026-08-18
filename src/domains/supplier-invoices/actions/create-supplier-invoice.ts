"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SupplierInvoiceService } from "../services/supplier-invoice-service";
import { createSupplierInvoiceSchema } from "../validation/supplier-invoice-schema";

export async function createSupplierInvoice(input: unknown) {
  const parsed = createSupplierInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid supplier invoice." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    const invoice = await new SupplierInvoiceService().create(context, parsed.data);

    revalidatePath("/purchasing");
    revalidatePath("/purchasing/supplier-invoices");
    revalidatePath(`/purchasing/supplier-invoices/${invoice.id}`);

    return { ok: true, id: invoice.id } as const;
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
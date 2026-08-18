"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { QuotationService } from "../services/quotation-service";

export async function markQuotationSentAction(id: string) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    const quotation = await new QuotationService().markSent(context, id);
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
    revalidatePath(`/customers/${quotation.customerId}`);

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

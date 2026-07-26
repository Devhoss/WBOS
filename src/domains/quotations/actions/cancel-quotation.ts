"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { QuotationService } from "../services/quotation-service";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "SALES"]);

export async function cancelQuotationAction(id: string) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to cancel quotations.", "FORBIDDEN");
    }

    const quotation = await new QuotationService().cancel(context, id);
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

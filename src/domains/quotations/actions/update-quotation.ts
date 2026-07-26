"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { QuotationService } from "../services/quotation-service";
import { updateQuotationSchema } from "../validation/quotation-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "SALES"]);

export async function updateQuotationAction(input: unknown) {
  const parsed = updateQuotationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid quotation.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to update quotations.", "FORBIDDEN");
    }

    const quotation = await new QuotationService().update(context, parsed.data);
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${quotation.id}`);
    revalidatePath(`/customers/${quotation.customerId}`);

    return { ok: true, data: { id: quotation.id } };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

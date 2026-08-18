"use server";

import { revalidatePath } from "next/cache";

import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { QuotationService } from "../services/quotation-service";
import { createQuotationSchema } from "../validation/quotation-schema";

export async function createQuotationAction(input: unknown) {
  const parsed = createQuotationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid quotation.",
    };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();

    requireManager(context);

    const quotation = await new QuotationService().create(context, parsed.data);
    revalidatePath("/quotations");
    revalidatePath(`/customers/${quotation.customerId}`);

    return { ok: true, data: { id: quotation.id } };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

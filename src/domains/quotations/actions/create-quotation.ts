"use server";

import { revalidatePath } from "next/cache";

import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { QuotationService } from "../services/quotation-service";
import { createQuotationSchema } from "../validation/quotation-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "MANAGER", "SALES"]);

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

    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to create quotations.", "FORBIDDEN");
    }

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

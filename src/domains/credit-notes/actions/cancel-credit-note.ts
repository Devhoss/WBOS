"use server";

import { revalidatePath } from "next/cache";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { CreditNoteService } from "../services/credit-note-service";

const allowedRoles = new Set(["OWNER", "ADMIN", "FINANCE"]);

export async function cancelCreditNoteAction(id: string, reason?: string) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to cancel credit notes.", "FORBIDDEN");
    }

    await new CreditNoteService().cancel(context, id, reason);
    revalidatePath("/credit-notes");

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

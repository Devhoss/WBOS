"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { CreditNoteService } from "../services/credit-note-service";

export async function cancelCreditNoteAction(id: string, reason?: string) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

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

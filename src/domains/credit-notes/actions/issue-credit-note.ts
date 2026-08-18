"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { CreditNoteService } from "../services/credit-note-service";
import { issueCreditNoteSchema } from "../validation/credit-note-schema";

export async function issueCreditNoteAction(input: unknown) {
  const parsed = issueCreditNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid credit note." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    const result = await new CreditNoteService().issue(context, parsed.data);
    revalidatePath("/credit-notes");
    revalidatePath(`/invoices/${parsed.data.invoiceId}`);

    return { ok: true, data: { id: result!.id } };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

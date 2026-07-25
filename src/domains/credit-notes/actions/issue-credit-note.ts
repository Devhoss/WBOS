"use server";

import { revalidatePath } from "next/cache";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";
import { CreditNoteService } from "../services/credit-note-service";
import { issueCreditNoteSchema } from "../validation/credit-note-schema";

const allowedRoles = new Set(["OWNER", "ADMIN", "FINANCE"]);

export async function issueCreditNoteAction(input: unknown) {
  const parsed = issueCreditNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid credit note." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    if (!allowedRoles.has(context.role)) {
      throw new BusinessError("You do not have permission to issue credit notes.", "FORBIDDEN");
    }

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

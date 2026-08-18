"use server";

import { revalidatePath } from "next/cache";

import { AttachmentService } from "@/domains/attachments/services/attachment-service";
import { requireManager } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

export async function deleteAttachmentAction(attachmentId: string, entityId: string) {
  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireManager(context);

    await new AttachmentService().remove(context, attachmentId);

    revalidatePath(`/purchasing/supplier-invoices/${entityId}`);
    revalidatePath(`/suppliers`);
    revalidatePath(`/purchasing`);

    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
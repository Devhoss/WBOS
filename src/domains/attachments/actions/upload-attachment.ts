"use server";

import type { AttachmentType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { AttachmentService } from "@/domains/attachments/services/attachment-service";
import { requireMinimumRole } from "@/infrastructure/authorization/rbac";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const allowedAttachmentTypes = new Set<AttachmentType>([
  "PROFORMA",
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "BILL_OF_LADING",
  "INSURANCE",
  "PAYMENT_RECEIPT",
  "OTHER",
]);

export async function uploadAttachmentAction(formData: FormData) {
  const entityType = formData.get("entityType") as string;
  const entityId = formData.get("entityId") as string;
  const attachmentTypeRaw = formData.get("attachmentType") as string | null;
  const file = formData.get("file") as File | null;

  if (!entityType || !entityId) {
    return { ok: false, message: "Missing attachment reference." };
  }

  const attachmentType = (attachmentTypeRaw && allowedAttachmentTypes.has(attachmentTypeRaw as AttachmentType)
    ? attachmentTypeRaw
    : "OTHER") as AttachmentType;

  if (!file || file.size === 0) {
    return { ok: false, message: "No file provided." };
  }

  if (!allowedMimeTypes.has(file.type)) {
    return { ok: false, message: "Only PDF, JPG, PNG, GIF, and WEBP files are allowed." };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, message: "File size must be under 10 MB." };
  }

  try {
    const context = await new AuthenticatedRequestContextService().getCurrentContext();
    requireMinimumRole(context, "MANAGER");

    const buffer = Buffer.from(await file.arrayBuffer());
    await new AttachmentService().upload(context, {
      entityType,
      entityId,
      fileName: file.name,
      mimeType: file.type,
      data: buffer,
      attachmentType,
    });

    revalidatePath(`/purchasing/supplier-invoices/${entityId}`);
    revalidatePath(`/purchasing/import-shipments/${entityId}`);
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
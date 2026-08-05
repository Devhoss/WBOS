import type { AttachmentType } from "@prisma/client";

import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { AttachmentRepository } from "../repositories/attachment-repository";
import { getDefaultStorageProviderRegistry } from "../providers/storage-provider-registry";
import type { StorageProviderRegistry } from "../providers/storage-provider-registry";

export type UploadAttachmentInput = {
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
  attachmentType?: AttachmentType;
};

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export class AttachmentService {
  constructor(
    private readonly attachments = new AttachmentRepository(),
    private readonly providers: StorageProviderRegistry = getDefaultStorageProviderRegistry(),
    private readonly maxBytes = DEFAULT_MAX_BYTES,
  ) {}

  async upload(context: AuthenticatedRequestContext, input: UploadAttachmentInput) {
    const provider = this.providers.get("LOCAL");

    const { storageKey, sizeBytes } = await provider.save({
      organizationId: context.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      data: input.data,
    });

    const attachment = await this.attachments.create({
      organizationId: context.organizationId,
      uploadedById: context.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes,
      attachmentType: input.attachmentType ?? "OTHER",
      provider: provider.name,
      storageKey,
    });

    return {
      ...attachment,
      url: provider.getUrl(attachment.storageKey),
    };
  }

  async list(
    context: AuthenticatedRequestContext,
    entityType: string,
    entityId: string,
  ) {
    const rows = await this.attachments.listByEntity(context.organizationId, entityType, entityId);
    const provider = this.providers.get("LOCAL");

    return rows.map((row) => ({
      ...row,
      url: provider.getUrl(row.storageKey),
    }));
  }

  async getFile(
    context: AuthenticatedRequestContext,
    id: string,
  ): Promise<{ attachment: { id: string; fileName: string; mimeType: string }; data: Buffer }> {
    const attachment = await this.attachments.findById(context.organizationId, id);

    if (!attachment || attachment.archivedAt) {
      throw new BusinessError("Attachment was not found.", "ATTACHMENT_NOT_FOUND");
    }

    const provider = this.providers.get(attachment.provider);
    const data = await provider.read(attachment.storageKey);

    if (!data) {
      throw new BusinessError("Attachment file could not be read.", "ATTACHMENT_READ_FAILED");
    }

    return {
      attachment: { id: attachment.id, fileName: attachment.fileName, mimeType: attachment.mimeType },
      data,
    };
  }

  async remove(context: AuthenticatedRequestContext, id: string): Promise<void> {
    const attachment = await this.attachments.findById(context.organizationId, id);

    if (!attachment || attachment.archivedAt) {
      throw new BusinessError("Attachment was not found.", "ATTACHMENT_NOT_FOUND");
    }

    const provider = this.providers.get(attachment.provider);
    await provider.delete(attachment.storageKey);
    await this.attachments.archive(context.organizationId, id);
  }
}

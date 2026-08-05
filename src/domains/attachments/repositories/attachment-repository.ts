import type { AttachmentType, StorageProvider } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

export type CreateAttachmentInput = {
  organizationId: string;
  uploadedById: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  attachmentType: AttachmentType;
  provider: StorageProvider;
  storageKey: string;
};

export class AttachmentRepository {
  async create(input: CreateAttachmentInput) {
    return prisma.attachment.create({ data: input });
  }

  async listByEntity(organizationId: string, entityType: string, entityId: string) {
    return prisma.attachment.findMany({
      where: { organizationId, entityType, entityId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    return prisma.attachment.findFirst({
      where: { id, organizationId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async archive(organizationId: string, id: string) {
    return prisma.attachment.updateMany({
      where: { id, organizationId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  }
}
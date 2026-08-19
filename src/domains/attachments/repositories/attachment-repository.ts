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
  /** Page position within the entity. Zero unless the caller orders its set. */
  sortOrder?: number;
  /** SHA-256 of the bytes, when the caller wants retries to be idempotent. */
  contentHash?: string;
};

export class AttachmentRepository {
  async create(input: CreateAttachmentInput) {
    return prisma.attachment.create({ data: input });
  }

  async listByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    options?: { attachmentType?: AttachmentType; orderBySortOrder?: boolean },
  ) {
    return prisma.attachment.findMany({
      where: {
        organizationId,
        entityType,
        entityId,
        archivedAt: null,
        ...(options?.attachmentType ? { attachmentType: options.attachmentType } : {}),
      },
      // Ordered sets are ordered by intent, not by arrival: proof-of-delivery
      // pages can be photographed out of order and reordered afterwards.
      // createdAt breaks ties so the order is total and a re-run is stable.
      orderBy: options?.orderBySortOrder
        ? [{ sortOrder: "asc" }, { createdAt: "asc" }]
        : { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /** Live rows only — an archived duplicate must not block a re-upload. */
  async findLiveByContentHash(
    organizationId: string,
    entityType: string,
    entityId: string,
    contentHash: string,
  ) {
    return prisma.attachment.findFirst({
      where: { organizationId, entityType, entityId, contentHash, archivedAt: null },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async countLiveByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    attachmentType?: AttachmentType,
  ) {
    return prisma.attachment.count({
      where: {
        organizationId,
        entityType,
        entityId,
        archivedAt: null,
        ...(attachmentType ? { attachmentType } : {}),
      },
    });
  }

  async highestSortOrder(
    organizationId: string,
    entityType: string,
    entityId: string,
  ): Promise<number> {
    const row = await prisma.attachment.findFirst({
      where: { organizationId, entityType, entityId, archivedAt: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return row?.sortOrder ?? 0;
  }

  /**
   * Rewrite the order of a set in one transaction.
   *
   * `updateMany` is scoped by organizationId as well as id, so an id belonging
   * to another tenant updates nothing rather than being reordered into this
   * caller's set.
   */
  async applySortOrder(
    organizationId: string,
    entityType: string,
    entityId: string,
    orderedIds: string[],
  ): Promise<void> {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.attachment.updateMany({
          where: { id, organizationId, entityType, entityId, archivedAt: null },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
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
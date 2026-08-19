import { createHash } from "crypto";

import { Prisma } from "@prisma/client";

import { AttachmentRepository } from "@/domains/attachments/repositories/attachment-repository";
import { AttachmentService } from "@/domains/attachments/services/attachment-service";
import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import {
  POD_ENTITY_TYPE,
  POD_MAX_DOCUMENTS_PER_DELIVERY,
  describePodFileRejection,
  type ProofOfDeliveryDocument,
  type ProofOfDeliveryView,
} from "../proof-of-delivery";

const POD_TYPE = "PROOF_OF_DELIVERY" as const;

export type UploadPodInput = {
  shipmentId: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
};

export type UploadPodResult = {
  document: ProofOfDeliveryDocument;
  /**
   * True when these exact bytes were already on this delivery and the existing
   * document was returned instead of a second copy being written.
   */
  duplicate: boolean;
};

type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  storageKey: string;
  createdAt: Date;
  uploadedBy: { id: string; name: string | null } | null;
};

/**
 * The proof-of-delivery document set for a delivery.
 *
 * Every method takes the caller's context and scopes every query by
 * `context.organizationId`. Nothing here accepts an organization id from the
 * caller, so a document id or shipment id belonging to another tenant resolves
 * to nothing and is reported as "not found" — never as "forbidden", which would
 * confirm the row exists.
 */
export class ProofOfDeliveryService {
  constructor(
    private readonly attachments = new AttachmentService(),
    private readonly repository = new AttachmentRepository(),
  ) {}

  /**
   * Prove the delivery belongs to the caller's organization.
   *
   * Every mutating path goes through here first, so tenant isolation is
   * decided in one place rather than per route.
   */
  private async requireDelivery(context: AuthenticatedRequestContext, shipmentId: string) {
    const shipment = await prisma.shipment.findFirst({
      where: { id: shipmentId, organizationId: context.organizationId },
      select: { id: true, shipmentNumber: true, salesOrderId: true },
    });

    if (!shipment) {
      throw new BusinessError("Delivery was not found.", "DELIVERY_NOT_FOUND");
    }

    return shipment;
  }

  private toDocument(row: AttachmentRow, index: number): ProofOfDeliveryDocument {
    return {
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      // Presented as a contiguous 1..n page number regardless of the stored
      // values, which develop gaps as pages are removed.
      pageNumber: index + 1,
      url: `/api/uploads/${row.storageKey}`,
      uploadedAt: row.createdAt.toISOString(),
      uploadedBy: row.uploadedBy ? { id: row.uploadedBy.id, name: row.uploadedBy.name } : null,
    };
  }

  /** The ordered set for one delivery. */
  async listForDelivery(
    context: AuthenticatedRequestContext,
    shipmentId: string,
  ): Promise<ProofOfDeliveryDocument[]> {
    await this.requireDelivery(context, shipmentId);
    const rows = await this.repository.listByEntity(
      context.organizationId,
      POD_ENTITY_TYPE,
      shipmentId,
      { attachmentType: POD_TYPE, orderBySortOrder: true },
    );
    return rows.map((row, index) => this.toDocument(row as AttachmentRow, index));
  }

  /**
   * Everything a sales order should show: one set per delivery, plus the
   * pre-POD single signed invoice if the order has one.
   */
  async listForSalesOrder(
    context: AuthenticatedRequestContext,
    salesOrderId: string,
  ): Promise<ProofOfDeliveryView> {
    const order = await prisma.salesOrder.findFirst({
      where: { id: salesOrderId, organizationId: context.organizationId, archivedAt: null },
      select: {
        id: true,
        soNumber: true,
        signedInvoicePath: true,
        shipments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            shipmentNumber: true,
            status: true,
            deliveredAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new BusinessError("Sales order was not found.", "SALES_ORDER_NOT_FOUND");
    }

    const deliveries = await Promise.all(
      order.shipments.map(async (shipment) => {
        const rows = await this.repository.listByEntity(
          context.organizationId,
          POD_ENTITY_TYPE,
          shipment.id,
          { attachmentType: POD_TYPE, orderBySortOrder: true },
        );
        return {
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          status: shipment.status,
          deliveredAt: shipment.deliveredAt ? shipment.deliveredAt.toISOString() : null,
          documents: rows.map((row, index) => this.toDocument(row as AttachmentRow, index)),
        };
      }),
    );

    return {
      salesOrderId: order.id,
      soNumber: order.soNumber,
      deliveries,
      legacySignedInvoicePath: order.signedInvoicePath,
    };
  }

  /**
   * Add one page to a delivery's set.
   *
   * Idempotent on the file's contents. A handset that uploads successfully and
   * then loses the reply will retry with identical bytes; without that, every
   * dropped connection would leave the delivery one duplicate page heavier, and
   * the retry the requirements ask for would be unusable in the exact
   * circumstance it exists for.
   */
  async upload(
    context: AuthenticatedRequestContext,
    input: UploadPodInput,
  ): Promise<UploadPodResult> {
    await this.requireDelivery(context, input.shipmentId);

    const rejection = describePodFileRejection(input.mimeType, input.data.byteLength);
    if (rejection) {
      throw new BusinessError(rejection, "POD_FILE_REJECTED");
    }

    const contentHash = createHash("sha256").update(input.data).digest("hex");

    const existing = await this.repository.findLiveByContentHash(
      context.organizationId,
      POD_ENTITY_TYPE,
      input.shipmentId,
      contentHash,
    );
    if (existing) {
      return { document: this.toDocument(existing as AttachmentRow, existing.sortOrder - 1), duplicate: true };
    }

    const liveCount = await this.repository.countLiveByEntity(
      context.organizationId,
      POD_ENTITY_TYPE,
      input.shipmentId,
      POD_TYPE,
    );
    if (liveCount >= POD_MAX_DOCUMENTS_PER_DELIVERY) {
      throw new BusinessError(
        `A delivery can hold at most ${POD_MAX_DOCUMENTS_PER_DELIVERY} proof-of-delivery documents.`,
        "POD_LIMIT_REACHED",
      );
    }

    const highest = await this.repository.highestSortOrder(
      context.organizationId,
      POD_ENTITY_TYPE,
      input.shipmentId,
    );

    try {
      const created = await this.attachments.upload(context, {
        entityType: POD_ENTITY_TYPE,
        entityId: input.shipmentId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        data: input.data,
        attachmentType: POD_TYPE,
        sortOrder: highest + 1,
        contentHash,
      });

      return {
        document: this.toDocument(
          { ...created, uploadedBy: { id: context.userId, name: null } } as AttachmentRow,
          created.sortOrder - 1,
        ),
        duplicate: false,
      };
    } catch (error) {
      // Two retries of the same photo can race past the read above. The partial
      // unique index is the real guarantee; treat its violation as the
      // duplicate it is rather than surfacing a database error to the driver.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await this.repository.findLiveByContentHash(
          context.organizationId,
          POD_ENTITY_TYPE,
          input.shipmentId,
          contentHash,
        );
        if (raced) {
          return {
            document: this.toDocument(raced as AttachmentRow, raced.sortOrder - 1),
            duplicate: true,
          };
        }
      }
      throw error;
    }
  }

  /** Soft-delete one page and remove its file. */
  async remove(context: AuthenticatedRequestContext, documentId: string): Promise<void> {
    const row = await this.repository.findById(context.organizationId, documentId);

    if (!row || row.archivedAt || row.attachmentType !== POD_TYPE) {
      throw new BusinessError("Proof-of-delivery document was not found.", "POD_NOT_FOUND");
    }

    await this.attachments.remove(context, documentId);
  }

  /**
   * Rewrite page order.
   *
   * The submitted list must be exactly the delivery's live set. Accepting a
   * subset would silently leave the omitted pages at whatever position they
   * held, which reads as a successful reorder that did not happen.
   */
  async reorder(
    context: AuthenticatedRequestContext,
    shipmentId: string,
    orderedIds: string[],
  ): Promise<ProofOfDeliveryDocument[]> {
    await this.requireDelivery(context, shipmentId);

    const current = await this.repository.listByEntity(
      context.organizationId,
      POD_ENTITY_TYPE,
      shipmentId,
      { attachmentType: POD_TYPE, orderBySortOrder: true },
    );

    const currentIds = new Set(current.map((row) => row.id));
    const submitted = new Set(orderedIds);

    if (
      orderedIds.length !== currentIds.size ||
      submitted.size !== orderedIds.length ||
      orderedIds.some((id) => !currentIds.has(id))
    ) {
      throw new BusinessError(
        "The page order must list every document in this delivery exactly once.",
        "POD_REORDER_MISMATCH",
      );
    }

    await this.repository.applySortOrder(
      context.organizationId,
      POD_ENTITY_TYPE,
      shipmentId,
      orderedIds,
    );

    return this.listForDelivery(context, shipmentId);
  }

  /**
   * Resolve a document for streaming. Used by the token download route, which
   * has already established the organization from the signed token.
   */
  async findForDownload(organizationId: string, documentId: string) {
    return prisma.attachment.findFirst({
      where: {
        id: documentId,
        organizationId,
        attachmentType: POD_TYPE,
        entityType: POD_ENTITY_TYPE,
        archivedAt: null,
      },
      select: { id: true, fileName: true, mimeType: true, storageKey: true, provider: true },
    });
  }
}

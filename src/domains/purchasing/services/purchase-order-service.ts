import type { PurchaseOrderStatus } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";
import { SupplierRepository } from "@/domains/suppliers/repositories/supplier-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { PurchaseOrderRepository } from "../repositories/purchase-order-repository";
import type { CreatePurchaseOrderInput, UpdatePurchaseOrderInput } from "../validation/purchase-order-schema";

const validStatusTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED: ["PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["FULLY_RECEIVED", "CANCELLED"],
  FULLY_RECEIVED: [],
  CANCELLED: [],
};

export class PurchaseOrderService {
  constructor(
    private readonly orders = new PurchaseOrderRepository(),
    private readonly suppliers = new SupplierRepository(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
    private readonly settings = new BusinessSettingsRepository(),
  ) {}

  async create(context: AuthenticatedRequestContext, input: CreatePurchaseOrderInput) {
    const supplier = await this.suppliers.listActive(context.organizationId);
    const supplierExists = supplier.some((s) => s.id === input.supplierId);

    if (!supplierExists) {
      throw new BusinessError("Supplier was not found.", "PURCHASING_SUPPLIER_NOT_FOUND");
    }

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "PO",
      year: now.getFullYear(),
      prefix: "PO",
    });

    const order = await this.orders.create(
      context.organizationId,
      documentNumber,
      context.userId,
      input,
    );

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PURCHASE_ORDER_CREATED",
      entityType: "PurchaseOrder",
      entityId: order.id,
      summary: `Purchase order ${documentNumber} was created.`,
      metadata: {
        poNumber: documentNumber,
        supplierId: input.supplierId,
        totalAmount: input.totalAmount,
        lineCount: input.lines.length,
      },
    });

    return order;
  }

  async update(context: AuthenticatedRequestContext, input: UpdatePurchaseOrderInput) {
    const order = await this.orders.findById(context.organizationId, input.id);

    if (!order) {
      throw new BusinessError("Purchase order was not found.", "PURCHASING_ORDER_NOT_FOUND");
    }

    if (order.status !== "DRAFT") {
      throw new BusinessError("Only draft purchase orders can be edited.", "PURCHASING_NOT_DRAFT");
    }

    const updated = await this.orders.update(context.organizationId, input.id, input);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PURCHASE_ORDER_UPDATED",
      entityType: "PurchaseOrder",
      entityId: order.id,
      summary: `Purchase order ${order.poNumber} was updated.`,
      metadata: {
        poNumber: order.poNumber,
      },
    });

    return updated;
  }

  async submit(context: AuthenticatedRequestContext, id: string) {
    return this.transitionStatus(context, id, "PENDING_APPROVAL", "PURCHASE_ORDER_SUBMITTED");
  }

  async approve(context: AuthenticatedRequestContext, id: string) {
    const order = await this.orders.findById(context.organizationId, id);

    if (!order) {
      throw new BusinessError("Purchase order was not found.", "PURCHASING_ORDER_NOT_FOUND");
    }

    if (order.status !== "PENDING_APPROVAL") {
      throw new BusinessError("Only pending approval orders can be approved.", "PURCHASING_INVALID_STATUS");
    }

    const settings = await this.settings.findByOrganizationId(context.organizationId);

    if (settings?.approvalMode === "DUAL" && order.createdById === context.userId) {
      throw new BusinessError("The approver must be a different user than the creator.", "PURCHASING_SELF_APPROVAL");
    }

    await this.orders.updateStatus(context.organizationId, id, "APPROVED");

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PURCHASE_ORDER_APPROVED",
      entityType: "PurchaseOrder",
      entityId: order.id,
      summary: `Purchase order ${order.poNumber} was approved.`,
      metadata: {
        poNumber: order.poNumber,
        approvedById: context.userId,
      },
    });
  }

  async cancel(context: AuthenticatedRequestContext, id: string) {
    const order = await this.orders.findById(context.organizationId, id);

    if (!order) {
      throw new BusinessError("Purchase order was not found.", "PURCHASING_ORDER_NOT_FOUND");
    }

    const allowed = validStatusTransitions[order.status as PurchaseOrderStatus];

    if (!allowed.includes("CANCELLED")) {
      throw new BusinessError("This purchase order cannot be cancelled.", "PURCHASING_CANNOT_CANCEL");
    }

    await this.orders.updateStatus(context.organizationId, id, "CANCELLED");

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PURCHASE_ORDER_CANCELLED",
      entityType: "PurchaseOrder",
      entityId: order.id,
      summary: `Purchase order ${order.poNumber} was cancelled.`,
      metadata: {
        poNumber: order.poNumber,
      },
    });
  }

  async archive(context: AuthenticatedRequestContext, id: string) {
    const order = await this.orders.findById(context.organizationId, id);

    if (!order) {
      throw new BusinessError("Purchase order was not found.", "PURCHASING_ORDER_NOT_FOUND");
    }

    const archiveableStatuses: PurchaseOrderStatus[] = ["APPROVED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CANCELLED"];

    if (!archiveableStatuses.includes(order.status as PurchaseOrderStatus)) {
      throw new BusinessError("Only approved, received, or cancelled orders can be archived.", "PURCHASING_NOT_ARCHIVEABLE");
    }

    if (order.archivedAt) {
      throw new BusinessError("Purchase order is already archived.", "PURCHASING_ALREADY_ARCHIVED");
    }

    await this.orders.archive(context.organizationId, id, context.userId);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "PURCHASE_ORDER_ARCHIVED",
      entityType: "PurchaseOrder",
      entityId: order.id,
      summary: `Purchase order ${order.poNumber} was archived.`,
      metadata: { poNumber: order.poNumber },
    });
  }

  private async transitionStatus(
    context: AuthenticatedRequestContext,
    id: string,
    targetStatus: PurchaseOrderStatus,
    activityAction: string,
  ) {
    const order = await this.orders.findById(context.organizationId, id);

    if (!order) {
      throw new BusinessError("Purchase order was not found.", "PURCHASING_ORDER_NOT_FOUND");
    }

    const allowed = validStatusTransitions[order.status as PurchaseOrderStatus];

    if (!allowed.includes(targetStatus)) {
      throw new BusinessError(
        `Cannot transition from ${order.status} to ${targetStatus}.`,
        "PURCHASING_INVALID_TRANSITION",
      );
    }

    await this.orders.updateStatus(context.organizationId, id, targetStatus);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: activityAction,
      entityType: "PurchaseOrder",
      entityId: order.id,
      summary: `Purchase order ${order.poNumber} status changed to ${targetStatus}.`,
      metadata: {
        poNumber: order.poNumber,
        previousStatus: order.status,
        newStatus: targetStatus,
      },
    });
  }
}

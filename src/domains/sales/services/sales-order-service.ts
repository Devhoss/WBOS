import type { SalesOrderStatus } from "@prisma/client";

import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { CustomerRepository } from "@/domains/customers/repositories/customer-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { BusinessSettingsRepository } from "@/domains/settings/repositories/business-settings-repository";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SalesOrderRepository } from "../repositories/sales-order-repository";
import type { CreateSalesOrderInput, UpdateSalesOrderInput } from "../validation/sales-order-schema";

import { CustomerBalanceService } from "./customer-balance-service";
import { InvoiceService } from "./invoice-service";

const validStatusTransitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED: ["READY_FOR_INVOICE", "CANCELLED"],
  READY_FOR_INVOICE: ["INVOICED", "CANCELLED"],
  INVOICED: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export type CreditLimitWarning = {
  warning: true;
  currentOutstanding: number;
  creditLimit: number;
  orderTotal: number;
};

export class SalesOrderService {
  constructor(
    private readonly orders = new SalesOrderRepository(),
    private readonly customers = new CustomerRepository(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
    private readonly balances = new CustomerBalanceService(),
    private readonly settings = new BusinessSettingsRepository(),
    private readonly invoices = new InvoiceService(),
  ) {}

  async create(context: AuthenticatedRequestContext, input: CreateSalesOrderInput) {
    const customer = await this.customers.findById(context.organizationId, input.customerId);

    if (!customer || customer.archivedAt) {
      throw new BusinessError("Customer was not found.", "SALES_CUSTOMER_NOT_FOUND");
    }

    let creditLimitWarning: CreditLimitWarning | undefined;

    if (customer.creditLimit) {
      const outstanding = await this.balances.getOutstanding(context.organizationId, customer.id);

      if (outstanding + input.totalAmount > Number(customer.creditLimit)) {
        creditLimitWarning = {
          warning: true,
          currentOutstanding: outstanding,
          creditLimit: Number(customer.creditLimit),
          orderTotal: input.totalAmount,
        };
      }
    }

    const now = new Date();
    const { documentNumber } = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "SO",
      year: now.getFullYear(),
      prefix: "SO",
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
      action: "SALES_ORDER_CREATED",
      entityType: "SalesOrder",
      entityId: order.id,
      summary: `Sales order ${documentNumber} was created for ${customer.name}.`,
      metadata: {
        soNumber: documentNumber,
        customerId: input.customerId,
        totalAmount: input.totalAmount,
        lineCount: input.lines.length,
        creditLimitWarning: creditLimitWarning ? true : false,
      },
    });

    return { order, creditLimitWarning };
  }

  async update(context: AuthenticatedRequestContext, input: UpdateSalesOrderInput) {
    const order = await this.orders.findById(context.organizationId, input.id);

    if (!order) {
      throw new BusinessError("Sales order was not found.", "SALES_ORDER_NOT_FOUND");
    }

    if (order.status !== "DRAFT") {
      throw new BusinessError("Only draft sales orders can be edited.", "SALES_NOT_DRAFT");
    }

    const customer = await this.customers.findById(context.organizationId, input.customerId);

    if (!customer || customer.archivedAt) {
      throw new BusinessError("Customer was not found.", "SALES_CUSTOMER_NOT_FOUND");
    }

    const updated = await this.orders.update(context.organizationId, input.id, input);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SALES_ORDER_UPDATED",
      entityType: "SalesOrder",
      entityId: order.id,
      summary: `Sales order ${order.soNumber} was updated.`,
      metadata: { soNumber: order.soNumber },
    });

    return updated;
  }

  async submit(context: AuthenticatedRequestContext, id: string) {
    return this.transitionStatus(context, id, "PENDING_APPROVAL", "SALES_ORDER_SUBMITTED");
  }

  async approve(context: AuthenticatedRequestContext, id: string) {
    const order = await this.orders.findById(context.organizationId, id);

    if (!order) {
      throw new BusinessError("Sales order was not found.", "SALES_ORDER_NOT_FOUND");
    }

    if (order.status !== "PENDING_APPROVAL") {
      throw new BusinessError("Only pending approval orders can be approved.", "SALES_INVALID_STATUS");
    }

    const settings = await this.settings.findByOrganizationId(context.organizationId);

    if (settings?.approvalMode === "DUAL" && order.createdById === context.userId) {
      throw new BusinessError("The approver must be a different user than the creator.", "SALES_SELF_APPROVAL");
    }

    await this.orders.updateStatus(context.organizationId, id, "APPROVED");

    try {
      await this.invoices.generateFromOrder(context, id);
    } catch {
      // If invoice generation fails, the order is still approved
    }

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SALES_ORDER_APPROVED",
      entityType: "SalesOrder",
      entityId: order.id,
      summary: `Sales order ${order.soNumber} was approved.`,
      metadata: { soNumber: order.soNumber, approvedById: context.userId },
    });
  }

  async cancel(context: AuthenticatedRequestContext, id: string) {
    const order = await this.orders.findById(context.organizationId, id);

    if (!order) {
      throw new BusinessError("Sales order was not found.", "SALES_ORDER_NOT_FOUND");
    }

    const allowed = validStatusTransitions[order.status as SalesOrderStatus];

    if (!allowed.includes("CANCELLED")) {
      throw new BusinessError("This sales order cannot be cancelled.", "SALES_CANNOT_CANCEL");
    }

    await this.orders.updateStatus(context.organizationId, id, "CANCELLED");

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SALES_ORDER_CANCELLED",
      entityType: "SalesOrder",
      entityId: order.id,
      summary: `Sales order ${order.soNumber} was cancelled.`,
      metadata: { soNumber: order.soNumber },
    });
  }

  async archive(context: AuthenticatedRequestContext, id: string) {
    const order = await this.orders.findById(context.organizationId, id);

    if (!order) {
      throw new BusinessError("Sales order was not found.", "SALES_ORDER_NOT_FOUND");
    }

    const archiveableStatuses: SalesOrderStatus[] = ["APPROVED", "READY_FOR_INVOICE", "INVOICED", "PAID", "CANCELLED"];

    if (!archiveableStatuses.includes(order.status as SalesOrderStatus)) {
      throw new BusinessError("Only approved, invoiced, paid, or cancelled orders can be archived.", "SALES_NOT_ARCHIVEABLE");
    }

    if (order.archivedAt) {
      throw new BusinessError("Sales order is already archived.", "SALES_ALREADY_ARCHIVED");
    }

    await this.orders.archive(context.organizationId, id, context.userId);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "SALES_ORDER_ARCHIVED",
      entityType: "SalesOrder",
      entityId: order.id,
      summary: `Sales order ${order.soNumber} was archived.`,
      metadata: { soNumber: order.soNumber },
    });
  }

  private async transitionStatus(
    context: AuthenticatedRequestContext,
    id: string,
    targetStatus: SalesOrderStatus,
    activityAction: string,
  ) {
    const order = await this.orders.findById(context.organizationId, id);

    if (!order) {
      throw new BusinessError("Sales order was not found.", "SALES_ORDER_NOT_FOUND");
    }

    const allowed = validStatusTransitions[order.status as SalesOrderStatus];

    if (!allowed.includes(targetStatus)) {
      throw new BusinessError(
        `Cannot transition from ${order.status} to ${targetStatus}.`,
        "SALES_INVALID_TRANSITION",
      );
    }

    await this.orders.updateStatus(context.organizationId, id, targetStatus);

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: activityAction,
      entityType: "SalesOrder",
      entityId: order.id,
      summary: `Sales order ${order.soNumber} status changed to ${targetStatus}.`,
      metadata: { soNumber: order.soNumber, previousStatus: order.status, newStatus: targetStatus },
    });
  }
}

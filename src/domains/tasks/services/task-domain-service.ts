/* eslint-disable @typescript-eslint/no-explicit-any */

import { Prisma } from "@prisma/client";
import { ActivityLogRepository } from "@/domains/activity/repositories/activity-log-repository";
import { DocumentNumberService } from "@/domains/documents/services/document-number-service";
import { ProductRepository } from "@/domains/products/repositories/product-repository";
import { ShipmentRepository } from "@/domains/sales/repositories/shipment-repository";
import { ShipmentService } from "@/domains/sales/services/shipment-service";
import { prisma } from "@/infrastructure/database/prisma";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { BusinessCalendar } from "@/lib/business-calendar";
import { TaskRepository, type TaskFilters } from "../repositories/task-repository";

export type TaskSummary = {
  id: string;
  taskNumber: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  subtitle: string | null;
  warehouseId: string;
  warehouseName: string;
  assignedTo: { id: string; name: string; email: string } | null;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  bucket: string | null;
  businessDate: string | null;
};

export type ComposedTaskLine = {
  id: string;
  completedQuantity: number;
  status: string;
  notes: string | null;
  sortOrder: number;
  productId: string;
  productSku: string;
  productName: string;
  barcode: string | null;
  quantityOrdered: number;
  unitOfMeasure: string;
  binLocation: string | null;
};

export type ComposedTaskDetail = TaskSummary & {
  dueAt: Date | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  updatedAt: Date;
  referenceType: string;
  referenceId: string;
  reference: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  lines: ComposedTaskLine[];
};

export type PickingDetail = ComposedTaskDetail & {
  shipmentStatus: string | null;
  shipmentId: string | null;
  shipmentNotes: string | null;
  warehouseNotes: string | null;
  invoiceId: string | null;
  totalLines: number;
  pickedLines: number;
  totalQuantity: number;
  pickedQuantity: number;
  allPicked: boolean;
};

export type PickScanActionInput = {
  taskLineId: string;
  barcode: string;
  delta: number;
  clientEventId: string;
  deviceId?: string | null;
  scannedAt?: Date | null;
};

export class TaskDomainService {
  constructor(
    private readonly tasks = new TaskRepository(),
    private readonly shipments = new ShipmentRepository(),
    private readonly products = new ProductRepository(),
    private readonly shipmentService = new ShipmentService(),
    private readonly documents = new DocumentNumberService(),
    private readonly activityLogs = new ActivityLogRepository(),
  ) {}

  /**
   * Promotes SCHEDULED tasks whose dueAt has arrived to READY.
   *
   * Called before every read to ensure a consistent canonical status.
   *
   * TODO: This is intentionally centralized here rather than embedded in the
   * repository so it can be extracted into a background scheduler or domain
   * event handler once that infrastructure exists.
   */
  async ensurePromotedTasks(organizationId: string, scheduleBoundary: Date): Promise<void> {
    await prisma.task.updateMany({
      where: {
        organizationId,
        status: "SCHEDULED",
        dueAt: { lt: scheduleBoundary },
      },
      data: { status: "READY" },
    });
  }

  async createFromShipment(
    context: AuthenticatedRequestContext,
    shipment: any,
    assignedToId?: string,
  ): Promise<ComposedTaskDetail> {
    const doc = await this.documents.generate({
      organizationId: context.organizationId,
      documentType: "TSK",
      year: new Date().getFullYear(),
      prefix: "TSK",
    });

    const salesOrder = shipment.salesOrder as any;
    const customerName = salesOrder?.customer?.name ?? "";
    const lineCount = shipment.lines?.length ?? 0;

    const expectedShipDate: Date | null = salesOrder?.expectedShipDate ?? null;
    const calendar = new BusinessCalendar(context.organization.timezone);
    const isScheduled = expectedShipDate ? calendar.shouldSchedule(expectedShipDate) : false;

    const task = await this.tasks.create(context.organizationId, {
      taskNumber: doc.documentNumber,
      type: "PICK_ORDER",
      status: isScheduled ? "SCHEDULED" : "READY",
      title: `Pick ${salesOrder?.soNumber ?? ""} — ${customerName}`,
      subtitle: `${lineCount} items, ${shipment.warehouse?.name ?? ""}`,
      referenceType: "SALES_ORDER",
      referenceId: salesOrder?.id ?? shipment.salesOrderId,
      warehouseId: shipment.warehouseId,
      assignedToId: assignedToId ?? context.userId,
      createdById: context.userId,
      dueAt: expectedShipDate ?? undefined,
      metadata: { shipmentId: shipment.id },
    });

    if (shipment.lines?.length > 0) {
      await this.tasks.createLines(
        context.organizationId,
        task.id,
        shipment.lines.map((line: any, index: number) => ({
          referenceLineId: line.id,
          sortOrder: index + 1,
        })),
      );
    }

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "TASK_CREATED",
      entityType: "Task",
      entityId: task.id,
      summary: `Task ${doc.documentNumber} created for ${salesOrder?.soNumber ?? ""} by ${context.user?.name ?? "Unknown user"}`,
      metadata: {
        taskNumber: doc.documentNumber,
        taskType: "PICK_ORDER",
        referenceType: "SALES_ORDER",
        referenceId: salesOrder?.id ?? shipment.salesOrderId,
        shipmentId: shipment.id,
        lineCount,
      },
    });

    const soId = salesOrder?.id ?? shipment.salesOrderId;
    if (soId) {
      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "TASK_CREATED",
        entityType: "SalesOrder",
        entityId: soId,
        summary: `Pick task ${doc.documentNumber} was created for this order.`,
        metadata: { taskNumber: doc.documentNumber, shipmentId: shipment.id },
      });
    }

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "TASK_CREATED",
      entityType: "Shipment",
      entityId: shipment.id,
      summary: `Pick task ${doc.documentNumber} was created for this shipment.`,
      metadata: { taskNumber: doc.documentNumber },
    });

    return this.composeDetail(context.organizationId, task.id) as Promise<ComposedTaskDetail>;
  }

  async findById(
    organizationId: string,
    taskId: string,
    scheduleBoundary?: Date,
  ): Promise<ComposedTaskDetail | null> {
    if (scheduleBoundary) {
      await this.ensurePromotedTasks(organizationId, scheduleBoundary);
    }
    const task = await this.tasks.findById(organizationId, taskId);
    if (!task) return null;
    return this.composeDetail(organizationId, task);
  }

  async findMany(
    organizationId: string,
    filters: TaskFilters = {},
    scheduleBoundary?: Date,
  ): Promise<{ data: TaskSummary[]; total: number }> {
    if (scheduleBoundary) {
      await this.ensurePromotedTasks(organizationId, scheduleBoundary);
    }
    const { data, total } = await this.tasks.findMany(organizationId, filters);
    return { data: data.map((t) => this.toSummary(t)), total };
  }

  async start(
    context: AuthenticatedRequestContext,
    taskId: string,
    optimisticUpdatedAt: Date,
  ): Promise<ComposedTaskDetail> {
    const task = await this.tasks.findById(context.organizationId, taskId);
    if (!task) throw new BusinessError("Task not found.", "TASK_NOT_FOUND");
    if (task.status !== "READY" && task.status !== "SCHEDULED") throw new BusinessError("Task must be in READY or SCHEDULED status to start.", "TASK_INVALID_STATUS");

    const now = new Date();
    await this.tasks.updateStatusWithTimestamp(
      context.organizationId,
      taskId,
      "IN_PROGRESS",
      now,
      optimisticUpdatedAt,
    );

    const composed = (await this.composeDetail(context.organizationId, {
      ...task,
      status: "IN_PROGRESS" as any,
      startedAt: now,
      updatedAt: now,
    }))!;

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "TASK_STARTED",
      entityType: "Task",
      entityId: taskId,
      summary: `Task ${task.taskNumber} started by ${context.user?.name ?? "Unknown user"}`,
      metadata: {
        taskNumber: task.taskNumber,
        taskType: task.type,
      },
    });

    if (task.referenceType === "SALES_ORDER" && task.referenceId) {
      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "TASK_STARTED",
        entityType: "SalesOrder",
        entityId: task.referenceId,
        summary: `Pick task ${task.taskNumber} was started for this order.`,
        metadata: { taskNumber: task.taskNumber },
      });
    }

    const taskData = task.data as Record<string, unknown> | null;
    const shipmentId = taskData?.shipmentId as string | undefined;
    if (shipmentId) {
      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "TASK_STARTED",
        entityType: "Shipment",
        entityId: shipmentId,
        summary: `Pick task ${task.taskNumber} was started for this shipment.`,
        metadata: { taskNumber: task.taskNumber },
      });
    }

    return composed;
  }

  async complete(
    context: AuthenticatedRequestContext,
    taskId: string,
    optimisticUpdatedAt: Date,
  ): Promise<ComposedTaskDetail> {
    const task = await this.tasks.findById(context.organizationId, taskId);
    if (!task) throw new BusinessError("Task not found.", "TASK_NOT_FOUND");
    if (task.status !== "IN_PROGRESS") throw new BusinessError("Task must be IN_PROGRESS to complete.", "TASK_INVALID_STATUS");

    const composed = await this.composeDetail(context.organizationId, task);
    const incompleteLines = composed!.lines.filter(
      (l) => l.quantityOrdered > 0 && l.completedQuantity < l.quantityOrdered,
    );
    if (incompleteLines.length > 0) {
      throw new BusinessError(
        `Cannot complete task: ${incompleteLines.length} line(s) still have unpicked quantities.`,
        "TASK_LINES_INCOMPLETE",
      );
    }

    const now = new Date();
    await this.tasks.updateStatusWithTimestamp(
      context.organizationId,
      taskId,
      "COMPLETED",
      now,
      optimisticUpdatedAt,
    );

    const composed_result = (await this.composeDetail(context.organizationId, {
      ...task,
      status: "COMPLETED" as any,
      completedAt: now,
      updatedAt: now,
    }))!;

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "TASK_COMPLETED",
      entityType: "Task",
      entityId: taskId,
      summary: `Task ${task.taskNumber} completed by ${context.user?.name ?? "Unknown user"}`,
      metadata: {
        taskNumber: task.taskNumber,
        taskType: task.type,
      },
    });

    if (task.referenceType === "SALES_ORDER" && task.referenceId) {
      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "TASK_COMPLETED",
        entityType: "SalesOrder",
        entityId: task.referenceId,
        summary: `Pick task ${task.taskNumber} was completed for this order.`,
        metadata: { taskNumber: task.taskNumber },
      });
    }

    const taskData = task.data as Record<string, unknown> | null;
    const shipmentId = taskData?.shipmentId as string | undefined;
    if (shipmentId) {
      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "TASK_COMPLETED",
        entityType: "Shipment",
        entityId: shipmentId,
        summary: `Pick task ${task.taskNumber} was completed for this shipment.`,
        metadata: { taskNumber: task.taskNumber },
      });
    }

    return composed_result;
  }

  async cancel(
    context: AuthenticatedRequestContext,
    taskId: string,
    reason: string | null,
    optimisticUpdatedAt: Date,
  ): Promise<ComposedTaskDetail> {
    const task = await this.tasks.findById(context.organizationId, taskId);
    if (!task) throw new BusinessError("Task not found.", "TASK_NOT_FOUND");
    if (task.status === "COMPLETED" || task.status === "CANCELLED") {
      throw new BusinessError("Cannot cancel a task in its current state.", "TASK_INVALID_STATUS");
    }

    const now = new Date();
    await this.tasks.updateStatusWithTimestamp(
      context.organizationId,
      taskId,
      "CANCELLED",
      now,
      optimisticUpdatedAt,
      { cancelledReason: reason },
    );

    const composed = (await this.composeDetail(context.organizationId, {
      ...task,
      status: "CANCELLED" as any,
      cancelledAt: now,
      cancelledReason: reason,
      updatedAt: now,
    }))!;

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "TASK_CANCELLED",
      entityType: "Task",
      entityId: taskId,
      summary: `Task ${task.taskNumber} cancelled by ${context.user?.name ?? "Unknown user"}`,
      metadata: {
        taskNumber: task.taskNumber,
        taskType: task.type,
        reason,
      },
    });

    return composed;
  }

  async updateLine(
    context: AuthenticatedRequestContext,
    taskId: string,
    lineId: string,
    completedQuantity: number,
  ): Promise<ComposedTaskDetail> {
    const task = await this.tasks.findById(context.organizationId, taskId);
    if (!task) throw new BusinessError("Task not found.", "TASK_NOT_FOUND");
    if (task.status !== "IN_PROGRESS") throw new BusinessError("Task is not in progress.", "TASK_NOT_IN_PROGRESS");

    const taskLine = task.lines.find((l) => l.id === lineId);
    if (!taskLine) throw new BusinessError("Task line not found.", "TASK_LINE_NOT_FOUND");

    const currentQty = Number(taskLine.completedQuantity);
    if (completedQuantity === currentQty) {
      return (await this.composeDetail(context.organizationId, taskId))!;
    }

    let shipmentId: string | undefined;

    if (task.type === "PICK_ORDER") {
      shipmentId = (task.data as Record<string, unknown> | null)?.shipmentId as string | undefined;
      if (!shipmentId) throw new BusinessError("Task is missing shipment reference.", "TASK_MISSING_SHIPMENT");

      const delta = completedQuantity - currentQty;

      if (delta > 0) {
        await this.shipmentService.addPickQuantity(
          context,
          shipmentId,
          taskLine.referenceLineId,
          delta,
        );

        const shipmentLine = await prisma.shipmentLine.findFirst({
          where: { id: taskLine.referenceLineId, organizationId: context.organizationId },
          select: { productId: true, pickedQuantity: true },
        });
        if (shipmentLine) {
          await prisma.pickingAction.create({
            data: {
              organizationId: context.organizationId,
              taskId,
              taskLineId: lineId,
              shipmentId,
              shipmentLineId: taskLine.referenceLineId,
              productId: shipmentLine.productId,
              barcode: "",
              delta: new Prisma.Decimal(delta),
              clientEventId: crypto.randomUUID(),
              deviceId: null,
              status: "BULK_ACCEPTED",
              resultingQuantity: shipmentLine.pickedQuantity,
              scannedAt: new Date(),
              createdById: context.userId,
            },
          });
        }
      } else if (delta < 0) {
        await this.shipmentService.removePickQuantity(
          context,
          shipmentId,
          taskLine.referenceLineId,
          Math.abs(delta),
        );

        const shipmentLine = await prisma.shipmentLine.findFirst({
          where: { id: taskLine.referenceLineId, organizationId: context.organizationId },
          select: { productId: true, pickedQuantity: true },
        });
        if (shipmentLine) {
          await prisma.pickingAction.create({
            data: {
              organizationId: context.organizationId,
              taskId,
              taskLineId: lineId,
              shipmentId,
              shipmentLineId: taskLine.referenceLineId,
              productId: shipmentLine.productId,
              barcode: "",
              delta: new Prisma.Decimal(delta),
              clientEventId: crypto.randomUUID(),
              deviceId: null,
              status: "UNDONE",
              resultingQuantity: shipmentLine.pickedQuantity,
              scannedAt: new Date(),
              createdById: context.userId,
            },
          });
        }
      }
    }

    await this.tasks.updateLineQuantity(
      context.organizationId,
      taskId,
      lineId,
      completedQuantity,
    );

    // Mark line COMPLETED if fully picked (quantityOrdered is resolved from the shipment line)
    const updated = await this.composeDetail(context.organizationId, taskId);
    if (updated) {
      const updatedLine = updated.lines.find((l) => l.id === lineId);
      if (updatedLine && updatedLine.quantityOrdered > 0 && updatedLine.completedQuantity >= updatedLine.quantityOrdered) {
        await this.tasks.updateLineQuantity(
          context.organizationId,
          taskId,
          lineId,
          completedQuantity,
          "COMPLETED" as any,
        );
      }
    }

    const final = updated ?? (await this.composeDetail(context.organizationId, taskId))!;

    await this.activityLogs.create({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "TASK_LINE_UPDATED",
      entityType: "Task",
      entityId: taskId,
      summary: `Line ${taskLine.referenceLineId} updated to ${completedQuantity} by ${context.user?.name ?? "Unknown user"}`,
      metadata: {
        taskNumber: task.taskNumber,
        lineId,
        completedQuantity,
      },
    });

    if (shipmentId) {
      await this.shipmentService.recomputeShipmentStatus(context, shipmentId);
    }

    return final;
  }

  async applyPickScanAction(
    context: AuthenticatedRequestContext,
    taskId: string,
    input: PickScanActionInput,
  ): Promise<PickingDetail> {
    const barcode = input.barcode.trim();
    const normalizedBarcode = barcode.toLowerCase();
    const delta = Number(input.delta);

    if (!input.clientEventId?.trim()) {
      throw new BusinessError("Missing scan event id.", "PICK_EVENT_ID_REQUIRED");
    }
    if (!barcode) {
      throw new BusinessError("Barcode is required.", "PICK_BARCODE_REQUIRED");
    }
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new BusinessError("Pick delta must be greater than zero.", "PICK_INVALID_DELTA");
    }

    let duplicate = false;
    let shipmentId: string | undefined;
    let shipmentLineId: string | undefined;
    let taskLineId: string | undefined;

    try {
      const task = await prisma.task.findFirst({
        where: { id: taskId, organizationId: context.organizationId },
        include: { lines: true },
      });
      if (!task) throw new BusinessError("Task not found.", "TASK_NOT_FOUND");
      if (task.status !== "IN_PROGRESS") throw new BusinessError("Task is not in progress.", "TASK_NOT_IN_PROGRESS");
      if (task.type !== "PICK_ORDER") throw new BusinessError("Task is not a picking task.", "TASK_INVALID_TYPE");

      const taskLine = task.lines.find((l) => l.id === input.taskLineId);
      if (!taskLine) throw new BusinessError("Task line not found.", "TASK_LINE_NOT_FOUND");
      taskLineId = taskLine.id;

      shipmentId = (task.data as Record<string, unknown> | null)?.shipmentId as string | undefined;
      if (!shipmentId) throw new BusinessError("Task is missing shipment reference.", "TASK_MISSING_SHIPMENT");
      const validShipmentId = shipmentId;

      const shipment = await prisma.shipment.findFirst({
        where: {
          id: shipmentId,
          organizationId: context.organizationId,
          status: { in: ["PENDING_PICK", "PICKING", "PICKED"] },
        },
        select: { id: true },
      });
      if (!shipment) throw new BusinessError("Shipment is not in picking status.", "SHIPMENT_INVALID_STATUS");

      const shipmentLine = await prisma.shipmentLine.findFirst({
        where: {
          id: taskLine.referenceLineId,
          shipmentId: validShipmentId,
          organizationId: context.organizationId,
        },
        include: {
          product: { select: { id: true, sku: true, barcode: true } },
        },
      });
      if (!shipmentLine) throw new BusinessError("Shipment line was not found.", "SHIPMENT_LINE_NOT_FOUND");
      shipmentLineId = shipmentLine.id;
      const validShipmentLineId = shipmentLine.id;

      const matches =
        shipmentLine.product.barcode?.toLowerCase() === normalizedBarcode ||
        shipmentLine.product.sku.toLowerCase() === normalizedBarcode;
      if (!matches) {
        throw new BusinessError("Scanned barcode does not match the expected pick line.", "PICK_BARCODE_MISMATCH");
      }

      await prisma.$transaction(async (tx) => {
        await tx.pickingAction.create({
          data: {
            organizationId: context.organizationId,
            taskId,
            taskLineId: taskLine.id,
            shipmentId: validShipmentId,
            shipmentLineId: validShipmentLineId,
            productId: shipmentLine.productId,
            barcode,
            delta: new Prisma.Decimal(delta),
            clientEventId: input.clientEventId,
            deviceId: input.deviceId ?? null,
            status: "ACCEPTED",
            resultingQuantity: new Prisma.Decimal(0),
            scannedAt: input.scannedAt ?? null,
            createdById: context.userId,
          },
        });

        const shipmentUpdateCount = await tx.$executeRaw`
          UPDATE "shipment_lines"
          SET "pickedQuantity" = "pickedQuantity" + ${new Prisma.Decimal(delta)},
              "barcodeVerifiedAt" = NOW()
          WHERE "id" = ${shipmentLine.id}
            AND "organizationId" = ${context.organizationId}
            AND "pickedQuantity" + ${new Prisma.Decimal(delta)} <= "quantity"
        `;
        if (Number(shipmentUpdateCount) !== 1) {
          throw new BusinessError("Cannot pick beyond the ordered quantity.", "SHIPMENT_OVER_PICK");
        }

        await tx.taskLine.updateMany({
          where: { id: taskLine.id, taskId, organizationId: context.organizationId },
          data: {
            completedQuantity: { increment: new Prisma.Decimal(delta) },
            status: "IN_PROGRESS",
          },
        });
      }, { timeout: 3000, maxWait: 3000 });

      const updatedShipmentLine = await prisma.shipmentLine.findFirst({
        where: { id: shipmentLineId, organizationId: context.organizationId },
        select: { pickedQuantity: true, quantity: true },
      });
      if (updatedShipmentLine && taskLineId) {
        await prisma.taskLine.updateMany({
          where: { id: taskLineId, taskId, organizationId: context.organizationId },
          data: {
            status: Number(updatedShipmentLine.pickedQuantity) >= Number(updatedShipmentLine.quantity)
              ? "COMPLETED"
              : "IN_PROGRESS",
          },
        });
        await prisma.pickingAction.updateMany({
          where: {
            organizationId: context.organizationId,
            clientEventId: input.clientEventId,
          },
          data: {
            resultingQuantity: updatedShipmentLine.pickedQuantity,
          },
        });
      }

      if (shipmentId) {
        await this.shipmentService.recomputeShipmentStatus(context, shipmentId);
      }
    } catch (error: any) {
      if (error?.code === "P2002") {
        duplicate = true;
      } else {
        throw error;
      }
    }

    const detail = await this.getPickingDetail(context.organizationId, taskId);
    if (!detail) throw new BusinessError("Task not found.", "TASK_NOT_FOUND");

    if (!duplicate) {
      await this.activityLogs.create({
        organizationId: context.organizationId,
        userId: context.userId,
        action: "PICK_SCAN_RECORDED",
        entityType: "Task",
        entityId: taskId,
        summary: `Pick scan recorded by ${context.user?.name ?? "Unknown user"}`,
        metadata: {
          taskId,
          taskLineId: input.taskLineId,
          barcode,
          delta,
          clientEventId: input.clientEventId,
        },
      });
    }

    return detail;
  }

  async getPickingDetail(
    organizationId: string,
    taskId: string,
    scheduleBoundary?: Date,
  ): Promise<PickingDetail | null> {
    if (scheduleBoundary) {
      await this.ensurePromotedTasks(organizationId, scheduleBoundary);
    }
    const task = await this.tasks.findById(organizationId, taskId);
    if (!task) return null;

    const composed = await this.composeDetail(organizationId, task);
    if (!composed) return null;

    const lines = composed.lines;
    const totalLines = lines.length;
    const pickedLines = lines.filter((l) => l.status === "COMPLETED").length;
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantityOrdered, 0);
    const pickedQuantity = lines.reduce((sum, l) => sum + l.completedQuantity, 0);

    let shipmentStatus: string | null = null;
    let shipmentId: string | null = null;
    let shipmentNotes: string | null = null;
    let warehouseNotes: string | null = null;
    let invoiceId: string | null = null;

    if (task.type === "PICK_ORDER") {
      shipmentId = (task.data as Record<string, unknown> | null)?.shipmentId as string | undefined ?? null;
      if (shipmentId) {
        const shipment = await this.shipments.findById(organizationId, shipmentId);
        shipmentStatus = shipment?.status ?? null;
        shipmentNotes = shipment?.notes ?? null;
        warehouseNotes = shipment?.warehouseNotes ?? null;
        if (shipment?.salesOrderId) {
          const invoice = await prisma.invoice.findFirst({
            where: { salesOrderId: shipment.salesOrderId, organizationId, status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
            select: { id: true },
            orderBy: { createdAt: "desc" },
          });
          invoiceId = invoice?.id ?? null;
        }
      }
    }

    return {
      ...composed,
      shipmentStatus,
      shipmentId,
      shipmentNotes,
      warehouseNotes,
      invoiceId,
      totalLines,
      pickedLines,
      totalQuantity,
      pickedQuantity,
      allPicked: totalLines > 0 && pickedLines === totalLines,
    };
  }

  private toSummary(task: any): TaskSummary {
    return {
      id: task.id,
      taskNumber: task.taskNumber,
      type: task.type,
      status: task.status,
      priority: task.priority,
      title: task.title,
      subtitle: task.subtitle,
      warehouseId: task.warehouseId,
      warehouseName: task.warehouse?.name ?? "",
      assignedTo: task.assignedTo ? { id: task.assignedTo.id, name: task.assignedTo.name, email: task.assignedTo.email } : null,
      dueAt: task.dueAt ?? null,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      bucket: null,
      businessDate: null,
    };
  }

  private async composeDetail(
    organizationId: string,
    taskOrId: any | string,
  ): Promise<ComposedTaskDetail | null> {
    const task = typeof taskOrId === "string"
      ? await this.tasks.findById(organizationId, taskOrId)
      : taskOrId;
    if (!task) return null;

    const summary = this.toSummary(task);

    let reference: Record<string, unknown> | null = null;
    const composedLines: ComposedTaskLine[] = [];

    if (task.referenceType === "SALES_ORDER" && task.type === "PICK_ORDER") {
      const shipmentId = (task.data as Record<string, unknown> | null)?.shipmentId as string | undefined;
      if (shipmentId) {
        const shipment = await this.shipments.findById(organizationId, shipmentId);
        if (shipment) {
          reference = {
            type: "SALES_ORDER",
            id: task.referenceId,
            soNumber: shipment.salesOrder?.soNumber ?? "",
            customerName: (shipment.salesOrder as any)?.customer?.name ?? "",
            shipmentNumber: shipment.shipmentNumber,
            shipmentStatus: shipment.status,
          };

          const shipmentLineMap = new Map(
            shipment.lines.map((sl) => [sl.id, sl]),
          );

          for (const tl of task.lines) {
            const sl = shipmentLineMap.get(tl.referenceLineId);
            composedLines.push({
              id: tl.id,
              completedQuantity: Number(tl.completedQuantity),
              status: tl.status,
              notes: tl.notes,
              sortOrder: tl.sortOrder,
              productId: (sl as any)?.product?.id ?? "",
              productSku: (sl as any)?.product?.sku ?? "",
              productName: sl?.productName ?? "",
              barcode: (sl as any)?.product?.barcode ?? null,
              quantityOrdered: Number((sl as any)?.quantity ?? 0),
              unitOfMeasure: "",
              binLocation: null,
            });
          }
        }
      }
    }

    if (composedLines.length === 0) {
      for (const tl of task.lines) {
        composedLines.push({
          id: tl.id,
          completedQuantity: Number(tl.completedQuantity),
          status: tl.status,
          notes: tl.notes,
          sortOrder: tl.sortOrder,
          productId: "",
          productSku: "",
          productName: "",
          barcode: null,
          quantityOrdered: 0,
          unitOfMeasure: "",
          binLocation: null,
        });
      }
    }

    return {
      ...summary,
      dueAt: task.dueAt,
      cancelledAt: task.cancelledAt,
      cancelledReason: task.cancelledReason,
      updatedAt: task.updatedAt,
      referenceType: task.referenceType,
      referenceId: task.referenceId,
      reference,
      metadata: task.data as Record<string, unknown> | null,
      lines: composedLines,
    };
  }
}

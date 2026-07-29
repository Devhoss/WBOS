/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma, type TaskStatus, type TaskLineStatus } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";
import { BusinessError } from "@/shared/errors/business-error";

function assertValidDate(value: Date, label: string): void {
  if (isNaN(value.getTime())) {
    throw new BusinessError(
      `Invalid date for ${label}. The operation cannot be completed.`,
      "INVALID_DATE",
    );
  }
}

export type TaskFilters = {
  type?: string;
  status?: TaskStatus;
  assignedToId?: string;
  warehouseId?: string;
  referenceType?: string;
  referenceId?: string;
  filter?: "today" | "scheduled";
  scheduleBoundary?: Date;
  page?: number;
  pageSize?: number;
};

export class TaskRepository {
  async findById(organizationId: string, id: string) {
    return prisma.task.findFirst({
      where: { id, organizationId },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        warehouse: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findMany(organizationId: string, filters: TaskFilters = {}) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const where: Prisma.TaskWhereInput = { organizationId };

    if (filters.type) where.type = filters.type as any;
    if (filters.status) where.status = filters.status;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.referenceType) where.referenceType = filters.referenceType as any;
    if (filters.referenceId) where.referenceId = filters.referenceId;
    if (filters.filter === "today") {
      if (filters.scheduleBoundary) {
        where.OR = [
          { status: { in: ["READY", "IN_PROGRESS"] } },
          { status: "SCHEDULED" as const, dueAt: { lt: filters.scheduleBoundary } },
        ];
      } else {
        where.status = { in: ["READY", "IN_PROGRESS"] };
      }
    } else if (filters.filter === "scheduled") {
      where.status = "SCHEDULED";
      if (filters.scheduleBoundary) {
        where.dueAt = { gte: filters.scheduleBoundary };
      }
    }

    if (filters.filter === "today" && filters.scheduleBoundary) {
      await prisma.task.updateMany({
        where: {
          organizationId,
          status: "SCHEDULED",
          dueAt: { lt: filters.scheduleBoundary },
        },
        data: { status: "READY" },
      });
    }

    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          lines: { orderBy: { sortOrder: "asc" } },
          warehouse: { select: { id: true, name: true, code: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async create(
    organizationId: string,
    data: {
      taskNumber: string;
      type: string;
      title: string;
      subtitle?: string | null;
      referenceType: string;
      referenceId: string;
      warehouseId: string;
      assignedToId: string;
      createdById: string;
      status?: string;
      priority?: string;
      dueAt?: Date | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    return prisma.task.create({
      data: {
        organizationId,
        taskNumber: data.taskNumber,
        type: data.type as any,
        status: (data.status ?? "READY") as any,
        title: data.title,
        subtitle: data.subtitle,
        referenceType: data.referenceType as any,
        referenceId: data.referenceId,
        warehouseId: data.warehouseId,
        assignedToId: data.assignedToId,
        createdById: data.createdById,
        priority: (data.priority ?? "NORMAL") as any,
        dueAt: data.dueAt,
        data: (data.metadata ?? Prisma.DbNull) as any,
      },
    });
  }

  async createLines(
    organizationId: string,
    taskId: string,
    lines: {
      referenceLineId: string;
      sortOrder: number;
      notes?: string | null;
    }[],
  ) {
    await prisma.taskLine.createMany({
      data: lines.map((line) => ({
        organizationId,
        taskId,
        referenceLineId: line.referenceLineId,
        sortOrder: line.sortOrder,
        notes: line.notes,
      })),
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: TaskStatus,
    optimisticUpdatedAt: Date,
  ) {
    assertValidDate(optimisticUpdatedAt, "optimistic concurrency (updatedAt)");
    const result = await prisma.task.updateMany({
      where: { id, organizationId, updatedAt: optimisticUpdatedAt },
      data: { status },
    });
    if (result.count === 0) {
      const existing = await prisma.task.findFirst({ where: { id, organizationId }, select: { updatedAt: true } });
      if (!existing) throw new BusinessError("Task not found.", "TASK_NOT_FOUND");
      throw new BusinessError("Task was modified by another user. Reload and try again.", "TASK_CONFLICT");
    }
  }

  async updateStatusWithTimestamp(
    organizationId: string,
    id: string,
    status: TaskStatus,
    timestamp: Date,
    optimisticUpdatedAt: Date,
    extra?: Record<string, Date | string | null>,
  ) {
    assertValidDate(optimisticUpdatedAt, "optimistic concurrency (updatedAt)");
    assertValidDate(timestamp, "status timestamp");
    const data: Record<string, any> = { status };
    if (extra) {
      Object.assign(data, extra);
    }
    data[status === "COMPLETED" ? "completedAt" : status === "CANCELLED" ? "cancelledAt" : "startedAt"] = timestamp;

    const result = await prisma.task.updateMany({
      where: { id, organizationId, updatedAt: optimisticUpdatedAt },
      data,
    });
    if (result.count === 0) {
      const existing = await prisma.task.findFirst({ where: { id, organizationId }, select: { updatedAt: true } });
      if (!existing) throw new BusinessError("Task not found.", "TASK_NOT_FOUND");
      throw new BusinessError("Task was modified by another user. Reload and try again.", "TASK_CONFLICT");
    }
  }

  async updateLineQuantity(
    organizationId: string,
    taskId: string,
    lineId: string,
    completedQuantity: number,
    status?: TaskLineStatus,
  ) {
    const line = await prisma.taskLine.findFirst({
      where: { id: lineId, taskId, organizationId },
    });
    if (!line) throw new BusinessError("Task line not found.", "TASK_LINE_NOT_FOUND");

    const newStatus: TaskLineStatus =
      status ?? (completedQuantity > 0 ? "IN_PROGRESS" : "PENDING");

    return prisma.taskLine.update({
      where: { id: lineId },
      data: {
        completedQuantity: new Prisma.Decimal(completedQuantity),
        status: newStatus,
      },
    });
  }

  async cancelByReference(organizationId: string, referenceType: string, referenceId: string) {
    const now = new Date();
    return prisma.task.updateMany({
      where: {
        organizationId,
        referenceType: referenceType as any,
        referenceId,
        status: { in: ["SCHEDULED", "READY", "IN_PROGRESS"] },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        updatedAt: now,
      },
    });
  }

  async countActiveByReference(
    organizationId: string,
    referenceType: string,
    referenceId: string,
  ) {
    return prisma.task.count({
      where: {
        organizationId,
        referenceType: referenceType as any,
        referenceId,
        status: { in: ["SCHEDULED", "READY", "IN_PROGRESS"] },
      },
    });
  }
}

import { requireManager } from "@/infrastructure/authorization/rbac";
import type { AuthenticatedRequestContext } from "@/infrastructure/request/authenticated-request-context";
import { BusinessCalendar } from "@/lib/business-calendar";

import type { TaskFilters } from "../repositories/task-repository";
import { TaskDomainService, type ComposedTaskDetail, type PickScanActionInput, type PickingDetail, type TaskSummary } from "./task-domain-service";
import { BusinessError } from "@/shared/errors/business-error";

function parseOptimisticDate(updatedAt: string): Date {
  if (!updatedAt) {
    throw new BusinessError(
      "Missing optimistic concurrency token (updatedAt). Reload the task and try again.",
      "MISSING_UPDATED_AT",
    );
  }
  const date = new Date(updatedAt);
  if (isNaN(date.getTime())) {
    throw new BusinessError(
      "Invalid optimistic concurrency token (updatedAt). Reload the task and try again.",
      "INVALID_UPDATED_AT",
    );
  }
  return date;
}

export class TaskApplicationService {
  constructor(
    private readonly domain = new TaskDomainService(),
  ) {}

  async listTasks(
    context: AuthenticatedRequestContext,
    filters: TaskFilters = {},
  ): Promise<{ tasks: TaskSummary[]; total: number }> {
    requireManager(context);
    const calendar = new BusinessCalendar(context.organization.timezone);
    const scheduleBoundary = new Date();
    const { data, total } = await this.domain.findMany(context.organizationId, filters, scheduleBoundary);
    return {
      tasks: data.map((t) => ({
        ...t,
        bucket: t.dueAt ? calendar.bucket(t.dueAt) : null,
        businessDate: t.dueAt ? calendar.dateStr(t.dueAt) : null,
      })),
      total,
    };
  }

  async getTask(
    context: AuthenticatedRequestContext,
    taskId: string,
  ): Promise<ComposedTaskDetail | null> {
    requireManager(context);
    return this.domain.findById(context.organizationId, taskId, new Date());
  }

  async startTask(
    context: AuthenticatedRequestContext,
    taskId: string,
    updatedAt: string,
  ): Promise<ComposedTaskDetail> {
    requireManager(context);
    const optimisticUpdatedAt = parseOptimisticDate(updatedAt);
    return this.domain.start(context, taskId, optimisticUpdatedAt);
  }

  async completeTask(
    context: AuthenticatedRequestContext,
    taskId: string,
    updatedAt: string,
  ): Promise<ComposedTaskDetail> {
    requireManager(context);
    const optimisticUpdatedAt = parseOptimisticDate(updatedAt);
    return this.domain.complete(context, taskId, optimisticUpdatedAt);
  }

  async cancelTask(
    context: AuthenticatedRequestContext,
    taskId: string,
    reason: string | null,
    updatedAt: string,
  ): Promise<ComposedTaskDetail> {
    requireManager(context);
    const optimisticUpdatedAt = parseOptimisticDate(updatedAt);
    return this.domain.cancel(context, taskId, reason, optimisticUpdatedAt);
  }

  async rescheduleTask(
    context: AuthenticatedRequestContext,
    taskId: string,
    dueAt: string,
    updatedAt: string,
  ): Promise<ComposedTaskDetail> {
    requireManager(context);
    const optimisticUpdatedAt = parseOptimisticDate(updatedAt);
    const parsedDueAt = new Date(dueAt);
    return this.domain.reschedule(context, taskId, parsedDueAt, optimisticUpdatedAt);
  }

  async getPickingDetail(
    context: AuthenticatedRequestContext,
    taskId: string,
  ): Promise<PickingDetail | null> {
    requireManager(context);
    return this.domain.getPickingDetail(context.organizationId, taskId, new Date());
  }

  async updateTaskLine(
    context: AuthenticatedRequestContext,
    taskId: string,
    lineId: string,
    completedQuantity: number,
  ): Promise<ComposedTaskDetail> {
    requireManager(context);
    return this.domain.updateLine(context, taskId, lineId, completedQuantity);
  }

  async applyPickScanAction(
    context: AuthenticatedRequestContext,
    taskId: string,
    input: PickScanActionInput,
  ): Promise<PickingDetail> {
    requireManager(context);
    return this.domain.applyPickScanAction(context, taskId, input);
  }
}

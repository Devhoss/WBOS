"use server";

import { TaskApplicationService } from "@/domains/tasks/services/task-application-service";
import { createNotificationService } from "@/domains/notifications/services/create-notification-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

const service = new TaskApplicationService();
const notifications = createNotificationService();

export async function startTaskAction(taskId: string, updatedAt: string) {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  try {
    const task = await service.startTask(context, taskId, updatedAt);
    return { ok: true as const, task };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Failed to start task." };
  }
}

export async function completeTaskAction(taskId: string, updatedAt: string) {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  try {
    const task = await service.completeTask(context, taskId, updatedAt);
    await notifications.notifyTaskCompleted(
      { organizationId: context.organizationId, userId: context.userId },
      task.taskNumber,
      task.id,
    );
    return { ok: true as const, task };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Failed to complete task." };
  }
}

export async function cancelTaskAction(taskId: string, reason: string | null, updatedAt: string) {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  try {
    const task = await service.cancelTask(context, taskId, reason, updatedAt);
    return { ok: true as const, task };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Failed to cancel task." };
  }
}

export async function createPickTaskAction(salesOrderId: string, assignedToId?: string) {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  try {
    const { SalesOrderRepository } = await import("@/domains/sales/repositories/sales-order-repository");
    const { ShipmentRepository } = await import("@/domains/sales/repositories/shipment-repository");
    const { TaskDomainService } = await import("@/domains/tasks/services/task-domain-service");
    const { requireMinimumRole } = await import("@/infrastructure/authorization/rbac");

    requireMinimumRole(context, "WAREHOUSE");

    const orders = new SalesOrderRepository();
    const order = await orders.findById(context.organizationId, salesOrderId);
    if (!order) return { ok: false as const, message: "Sales order not found." };

    const shipmentsRepo = new ShipmentRepository();
    const activeShipments = await shipmentsRepo.listWithFilters(context.organizationId, {
      salesOrderId,
      status: "PENDING_PICK",
    });
    const shipments = activeShipments.data.filter((s) => s.status === "PENDING_PICK" || s.status === "PICKING");

    if (shipments.length === 0) return { ok: false as const, message: "No active shipments to pick." };

    const domain = new TaskDomainService();
    const tasks = [];
    for (const shipment of shipments) {
      const detail = await shipmentsRepo.findById(context.organizationId, shipment.id);
      if (!detail) continue;
      const task = await domain.createFromShipment(context, detail, assignedToId);
      tasks.push(task);
    }

    const notifiedUserIds = new Set<string>();
    for (const task of tasks) {
      const assigneeId = task.assignedTo?.id;
      if (assigneeId && !notifiedUserIds.has(assigneeId)) {
        notifiedUserIds.add(assigneeId);
        await notifications.notifyTaskAssigned(
          { organizationId: context.organizationId, userId: assigneeId },
          task.taskNumber,
          task.id,
        );
      }
    }

    return { ok: true as const, tasks };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Failed to create pick task." };
  }
}
